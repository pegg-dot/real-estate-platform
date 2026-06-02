/**
 * Scout change digest (spec 006, Phase 3) — renders the "what changed this week" feed.
 * Pure: enriched change events in → markdown out. High-severity first, human one-liners.
 */
import type { ChangeType, ChangeSeverity } from "./diff.js";

export interface EnrichedChange {
  apn: string;
  address: string | null;
  changeType: ChangeType;
  severity: ChangeSeverity;
  detail: Record<string, unknown>;
}

const usd = (n: unknown) => (typeof n === "number" ? `$${Math.round(n).toLocaleString()}` : "—");
const pct = (n: unknown) => (typeof n === "number" ? `${(n * 100).toFixed(1)}%` : "—");
const SEV_RANK: Record<ChangeSeverity, number> = { high: 0, notable: 1, info: 2 };
const ICON: Record<ChangeSeverity, string> = { high: "🔴", notable: "🟠", info: "⚪️" };

/** One human-readable line describing the change (no address — caller prepends it). */
function summarize(e: EnrichedChange): string {
  const d = e.detail;
  switch (e.changeType) {
    case "new_parcel": return `new to the scorable set (score ${d.score ?? "—"})`;
    case "price_change": {
      const dir = d.direction === "down" ? "DROP" : "rise";
      return `price ${dir} ${pct(d.deltaPct)} — ${usd(d.from)} → ${usd(d.to)}`;
    }
    case "ownership_change": return `likely SOLD / new owner — last arm's-length ${usd(d.toPrice)}`;
    case "score_jump": return `score ↑ ${d.from} → ${d.to} (+${d.delta})`;
    case "score_drop": return `score ↓ ${d.from} → ${d.to} (${d.delta})`;
    case "entered_shortlist": return `ENTERED the shortlist (score ${d.score ?? "—"}, CoC ${pct(d.headlineCoc)})`;
    case "exited_shortlist": return `dropped OUT of the shortlist`;
    case "gate_flag_new": return `newly trips a thesis constraint`;
    case "gate_flag_cleared": return `cleared a thesis constraint`;
    case "by_room_legality_change": return `by-room legality ${d.from} → ${d.to} (make-or-break)`;
    default: return e.changeType;
  }
}

export function renderChangeDigest(
  events: EnrichedChange[], opts: { baseline?: boolean; snapshotCount?: number },
): string {
  if (opts.baseline) {
    const n = (opts.snapshotCount ?? 0).toLocaleString();
    return `📷 **Baseline captured** (${n} properties snapshotted). ` +
      `Change tracking starts on the next run — there's nothing to diff against yet.`;
  }
  if (events.length === 0) return `✓ **No material changes** since the last run.`;

  const sorted = [...events].sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);
  const highCount = events.filter((e) => e.severity === "high").length;
  const out: string[] = [];
  out.push(`## 🛰️ What changed since last run — ${events.length} change(s)` +
    (highCount ? `, **${highCount} high-priority**` : ""));
  for (const e of sorted) {
    out.push(`- ${ICON[e.severity]} **${e.address ?? e.apn}** — ${summarize(e)}`);
  }
  return out.join("\n");
}
