/**
 * Scout diff (spec 006, Phase 3) — the pure core of the weekly loop.
 *
 * Given two runs' worth of property snapshots, emit the meaningful changes between them:
 * new parcels, price moves, ownership changes, score shifts, shortlist crossings, gate
 * flips, by-room legality changes. No DB, no I/O — just data in, change-events out — so
 * it's fully unit-testable. The orchestrator (refresh-market) reads/writes snapshots and
 * persists the events; this decides WHAT changed and HOW LOUD it is.
 */

export interface PropertySnapshot {
  propertyId: string;
  score: number | null;
  headlineCoc: number | null;
  gatePassed: boolean | null;
  lowConfidence: boolean | null;
  inShortlist: boolean | null;
  recommendedStructure: string | null;
  estMarketValue: number | null;
  latestAssessed: number | null;
  lastArmsPrice: number | null;
  byRoomLegal: boolean | null;
  ownerId: string | null;
}

export type ChangeType =
  | "new_parcel" | "price_change" | "ownership_change"
  | "score_jump" | "score_drop"
  | "entered_shortlist" | "exited_shortlist"
  | "gate_flag_new" | "gate_flag_cleared"
  | "by_room_legality_change";

export type ChangeSeverity = "info" | "notable" | "high";

export interface ChangeEvent {
  propertyId: string;
  changeType: ChangeType;
  severity: ChangeSeverity;
  detail: Record<string, unknown>;
}

export interface DiffThresholds {
  priceChangePct: number;   // fractional move in est value that counts (default 5%)
  priceDropHighPct: number; // a drop at/beyond this is "high" — the strongest buy signal
  scoreJump: number;        // absolute score points that counts as a jump/drop (default 5)
}

const DEFAULTS: DiffThresholds = { priceChangePct: 0.05, priceDropHighPct: 0.10, scoreJump: 5 };

export function diffSnapshots(
  prev: PropertySnapshot[],
  curr: PropertySnapshot[],
  thresholds: Partial<DiffThresholds> = {},
): ChangeEvent[] {
  const t = { ...DEFAULTS, ...thresholds };
  const prevById = new Map(prev.map((s) => [s.propertyId, s]));
  const events: ChangeEvent[] = [];

  for (const c of curr) {
    const p = prevById.get(c.propertyId);
    const id = c.propertyId;

    // --- new to the scorable set ---------------------------------------------
    if (!p) {
      events.push({ propertyId: id, changeType: "new_parcel", severity: "notable",
        detail: { score: c.score, headlineCoc: c.headlineCoc, inShortlist: c.inShortlist } });
      continue; // a brand-new parcel has no "from" to diff the rest against
    }

    // --- price move (est market value is the primary signal; fall back to assessed) ---
    const prevPrice = p.estMarketValue ?? p.latestAssessed;
    const currPrice = c.estMarketValue ?? c.latestAssessed;
    if (prevPrice != null && currPrice != null && prevPrice > 0) {
      const deltaPct = (currPrice - prevPrice) / prevPrice;
      if (Math.abs(deltaPct) >= t.priceChangePct) {
        const isDrop = deltaPct < 0;
        const severity: ChangeSeverity =
          isDrop && Math.abs(deltaPct) >= t.priceDropHighPct ? "high" : isDrop ? "notable" : "info";
        events.push({ propertyId: id, changeType: "price_change", severity,
          detail: { from: prevPrice, to: currPrice, deltaPct: Number(deltaPct.toFixed(4)), direction: isDrop ? "down" : "up" } });
      }
    }

    // --- ownership change: a new arm's-length sale price or a new owner since last run ---
    const newSale = p.lastArmsPrice !== c.lastArmsPrice && c.lastArmsPrice != null;
    const newOwner = p.ownerId !== c.ownerId && c.ownerId != null;
    if (newSale || newOwner) {
      events.push({ propertyId: id, changeType: "ownership_change", severity: "high",
        detail: { fromPrice: p.lastArmsPrice, toPrice: c.lastArmsPrice, ownerChanged: newOwner } });
    }

    // --- thesis score shift ---------------------------------------------------
    if (p.score != null && c.score != null) {
      const ds = c.score - p.score;
      if (ds >= t.scoreJump) {
        events.push({ propertyId: id, changeType: "score_jump", severity: "notable",
          detail: { from: p.score, to: c.score, delta: Number(ds.toFixed(2)) } });
      } else if (ds <= -t.scoreJump) {
        events.push({ propertyId: id, changeType: "score_drop", severity: "notable",
          detail: { from: p.score, to: c.score, delta: Number(ds.toFixed(2)) } });
      }
    }

    // --- shortlist crossing (the confident, gate-passing set) -----------------
    if (p.inShortlist === false && c.inShortlist === true) {
      events.push({ propertyId: id, changeType: "entered_shortlist", severity: "high",
        detail: { score: c.score, headlineCoc: c.headlineCoc } });
    } else if (p.inShortlist === true && c.inShortlist === false) {
      events.push({ propertyId: id, changeType: "exited_shortlist", severity: "notable",
        detail: { score: c.score, gatePassed: c.gatePassed, lowConfidence: c.lowConfidence } });
    }

    // --- gate flips (only when both sides are known) --------------------------
    if (p.gatePassed === true && c.gatePassed === false) {
      events.push({ propertyId: id, changeType: "gate_flag_new", severity: "notable", detail: {} });
    } else if (p.gatePassed === false && c.gatePassed === true) {
      events.push({ propertyId: id, changeType: "gate_flag_cleared", severity: "notable", detail: {} });
    }

    // --- by-room legality flip (make-or-break for student rentals) ------------
    if (p.byRoomLegal != null && c.byRoomLegal != null && p.byRoomLegal !== c.byRoomLegal) {
      events.push({ propertyId: id, changeType: "by_room_legality_change", severity: "high",
        detail: { from: p.byRoomLegal, to: c.byRoomLegal } });
    }
  }

  return events;
}
