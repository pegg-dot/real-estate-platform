/**
 * Regulatory radar digest (spec 006, Phase 3) — renders zoning changes as alpha.
 * Pure: radar events in → markdown out. Opportunities and risks called out distinctly.
 */
import type { RegulatoryEvent } from "./zoning.js";

export type RadarDigestEvent = RegulatoryEvent & { affectedParcels: number };

const DIR_ICON: Record<RegulatoryEvent["direction"], string> = {
  opportunity: "🟢", risk: "🔴", neutral: "⚪️",
};

export function renderRegulatoryDigest(events: RadarDigestEvent[]): string {
  if (events.length === 0) return `✓ **No regulatory changes** detected this run.`;

  // opportunities first (they're the time-boxed alpha), then risks, then neutral
  const order: RegulatoryEvent["direction"][] = ["opportunity", "risk", "neutral"];
  const sorted = [...events].sort((a, b) => order.indexOf(a.direction) - order.indexOf(b.direction));
  const opps = events.filter((e) => e.direction === "opportunity").length;

  const out: string[] = [];
  out.push(`## 🏛️ Regulatory radar — ${events.length} zoning change(s)` +
    (opps ? `, **${opps} opportunity(ies)**` : ""));
  for (const e of sorted) {
    out.push(`- ${DIR_ICON[e.direction]} **${e.zoneCode}** (${e.affectedParcels.toLocaleString()} parcels) — ${e.alphaNote}`);
  }
  return out.join("\n");
}
