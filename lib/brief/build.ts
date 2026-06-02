/**
 * The Monday Brief (spec 010 / Phase 4 004d) — the operating surface.
 *
 * Pure assembler: the week's signals in (scout diff + radar + mail queue + deals + verify-zoning
 * + LEARN divergence), ONE digest of ACTION QUEUES out. Each row carries exactly one reason it
 * surfaced and one action that routes through an EXISTING writer (approveMailer / transitionDeal)
 * — so the Brief informs AND acts, holding the line at action queues instead of another dashboard.
 * Optimizes Nate's attention as the scarce resource (the 8-hr week).
 */
export type BriefQueue =
  | "REGULATORY_KILL" | "ACT_ON_DEAL" | "ZONE_OPENED" | "MAIL" | "VERIFY_ZONING";

export interface BriefRow {
  queue: BriefQueue;
  title: string;     // the deal/parcel/owner this is about
  reason: string;    // the ONE reason it surfaced
  action: string;    // the ONE next action (names the writer it routes through)
  target: string;    // the write-back target id (deal id / lead id / zone)
}

export interface BriefInputs {
  mailQueue: Array<{ leadId: string; address: string | null; ownerName: string | null; score: number }>;
  dealsNeedingAction: Array<{ dealId: string; address: string | null; stage: string }>;
  zoneOpportunities: Array<{ zoneCode: string; affectedParcels: number; alphaNote: string }>;
  regulatoryKills: Array<{ dealId: string; address: string | null; zoneCode: string }>;
  verifyZoning: Array<{ ownerName: string | null; address: string | null }>;
  divergenceNote?: string | null;
}

export interface Brief {
  rows: BriefRow[];
  summary: string;
}

// urgent first; attention is the scarce resource
const QUEUE_ORDER: BriefQueue[] = ["REGULATORY_KILL", "ACT_ON_DEAL", "ZONE_OPENED", "MAIL", "VERIFY_ZONING"];

export function buildBrief(i: BriefInputs): Brief {
  const rows: BriefRow[] = [];

  for (const k of i.regulatoryKills) {
    rows.push({ queue: "REGULATORY_KILL", title: k.address ?? k.dealId,
      reason: `zoning flipped in ${k.zoneCode} — deal frozen mid-flight`,
      action: "review the frozen deal; transitionDeal to 'passed' or hold", target: k.dealId });
  }
  for (const d of i.dealsNeedingAction) {
    rows.push({ queue: "ACT_ON_DEAL", title: d.address ?? d.dealId,
      reason: `live deal sitting at '${d.stage}'`,
      action: `advance or pass — transitionDeal(${d.dealId})`, target: d.dealId });
  }
  for (const z of i.zoneOpportunities) {
    rows.push({ queue: "ZONE_OPENED", title: z.zoneCode,
      reason: z.alphaNote, action: `source the ${z.affectedParcels} newly-viable parcels (npm run leads --generate)`, target: z.zoneCode });
  }
  for (const m of i.mailQueue) {
    rows.push({ queue: "MAIL", title: `${m.address ?? "—"} (${m.ownerName ?? "owner"})`,
      reason: `motivated-seller score ${m.score}`,
      action: `approve a mailer — npm run leads --draft ${m.leadId}`, target: m.leadId });
  }
  for (const v of i.verifyZoning) {
    rows.push({ queue: "VERIFY_ZONING", title: v.address ?? v.ownerName ?? "unknown parcel",
      reason: "by-room legality unknown — a growth reservoir, not a mail target (yet)",
      action: "pull a per-parcel zoning determination", target: v.address ?? "unknown" });
  }

  rows.sort((a, b) => QUEUE_ORDER.indexOf(a.queue) - QUEUE_ORDER.indexOf(b.queue));

  const n = rows.length;
  const head = n === 0
    ? "✓ Nothing needs action this week — the board is clear."
    : `🗞️ ${n} action item(s) this week: ` +
      QUEUE_ORDER.map((q) => ({ q, c: rows.filter((r) => r.queue === q).length }))
        .filter((x) => x.c > 0).map((x) => `${x.c} ${x.q.replace(/_/g, "-").toLowerCase()}`).join(", ") + ".";
  const summary = i.divergenceNote ? `${head}\n📊 LEARN: ${i.divergenceNote}` : head;

  return { rows, summary };
}
