/**
 * Regulatory radar (spec 006, Phase 3) — turn a zoning-rule change into an ALPHA signal.
 *
 * Golden rule #3: zoning is a moving target, and a change is the opportunity. A zone that
 * just legalized by-the-room renting (or raised its unrelated-occupant cap) makes a whole
 * set of parcels newly viable *before* the market reprices them; a zone that tightened is a
 * risk to flag. This is the pure diff of zoning rules → regulatory events with an alpha
 * note. The DB side (count affected parcels, persist, re-flag property.by_room_legal) lives
 * in runRegulatoryRadar(); this decides WHAT changed and WHETHER it's opportunity or risk.
 */

export interface ZoneRule {
  zoneCode: string;
  byRoomLegal: boolean;
  maxUnrelated: number | null;
  stabilityFlag: string | null;
}

export type RegulatoryChangeType =
  | "new_rule" | "by_room_legal_change" | "max_unrelated_change" | "stability_flag_change";

export interface RegulatoryEvent {
  zoneCode: string;
  changeType: RegulatoryChangeType;
  direction: "opportunity" | "risk" | "neutral";
  detail: Record<string, unknown>;
  alphaNote: string;
}

export function detectZoningChanges(prev: ZoneRule[], curr: ZoneRule[]): RegulatoryEvent[] {
  const prevByZone = new Map(prev.map((r) => [r.zoneCode, r]));
  const events: RegulatoryEvent[] = [];

  for (const c of curr) {
    const p = prevByZone.get(c.zoneCode);

    // a zone we'd never recorded — surface it (opportunity if it allows by-room)
    if (!p) {
      events.push({
        zoneCode: c.zoneCode, changeType: "new_rule",
        direction: c.byRoomLegal ? "opportunity" : "neutral",
        detail: { byRoomLegal: c.byRoomLegal, maxUnrelated: c.maxUnrelated },
        alphaNote: `New zoning rule recorded for ${c.zoneCode}: by-room ${c.byRoomLegal ? "LEGAL" : "not legal"}` +
          (c.maxUnrelated != null ? `, max ${c.maxUnrelated} unrelated.` : "."),
      });
      continue;
    }

    // the make-or-break flag flipped
    if (p.byRoomLegal !== c.byRoomLegal) {
      const opportunity = c.byRoomLegal === true; // false→true legalizes
      events.push({
        zoneCode: c.zoneCode, changeType: "by_room_legal_change",
        direction: opportunity ? "opportunity" : "risk",
        detail: { from: p.byRoomLegal, to: c.byRoomLegal },
        alphaNote: opportunity
          ? `OPPORTUNITY: ${c.zoneCode} just LEGALIZED by-the-room renting — every parcel in this zone is newly viable for the by-room model. Move before the market reprices.`
          : `RISK: ${c.zoneCode} REVOKED by-the-room legality — existing/underwriting assumptions for parcels here must drop the by-room pro-forma; re-underwrite as whole-house.`,
      });
    }

    // the unrelated-occupant cap moved (more heads = more by-room rent)
    if (p.maxUnrelated !== c.maxUnrelated) {
      const raised = (c.maxUnrelated ?? 0) > (p.maxUnrelated ?? 0);
      events.push({
        zoneCode: c.zoneCode, changeType: "max_unrelated_change",
        direction: raised ? "opportunity" : "risk",
        detail: { from: p.maxUnrelated, to: c.maxUnrelated },
        alphaNote: raised
          ? `OPPORTUNITY: ${c.zoneCode} RAISED its unrelated-occupant cap ${p.maxUnrelated ?? "—"}→${c.maxUnrelated} — more legal heads per house lifts the by-room yield.`
          : `RISK: ${c.zoneCode} LOWERED its unrelated-occupant cap ${p.maxUnrelated ?? "—"}→${c.maxUnrelated} — by-room yield assumptions for this zone are now too high.`,
      });
    }

    // litigation / currency note changed — informational but worth a look
    if ((p.stabilityFlag ?? null) !== (c.stabilityFlag ?? null)) {
      events.push({
        zoneCode: c.zoneCode, changeType: "stability_flag_change", direction: "neutral",
        detail: { from: p.stabilityFlag, to: c.stabilityFlag },
        alphaNote: `${c.zoneCode} stability note changed — pull a fresh per-parcel zoning determination before acting: "${c.stabilityFlag ?? "(cleared)"}"`,
      });
    }
  }

  return events;
}
