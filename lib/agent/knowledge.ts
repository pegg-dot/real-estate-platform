/**
 * Knowledge preamble (spec 022 + knowledge layer) — the compounding wire. The distilled knowledge
 * tables (knowledge_rule, expert_profile) are the moat: every source we distill should make the
 * agent smarter. Previously they only reached the deterministic Coach/financing paths; the LLM
 * operator/analyst ran on a frozen, hand-typed prompt string. This loads the cited rules + expert
 * lenses at turn time and prepends them to the system prompt (full-context + prompt caching — stage
 * 1 of the CLAUDE.md plan; embeddings only if this proves insufficient). Fails OPEN (returns "") so
 * a knowledge miss never breaks the agent.
 */
import type { Sql } from "../db/client.js";

export async function knowledgePreamble(sql: Sql): Promise<string> {
  try {
    const rules = await sql<Array<{ slug: string | null; condition: string; recommendation: string; confidence: string; source: string | null }>>`
      select slug, condition, recommendation, confidence, source from knowledge_rule order by confidence desc, slug limit 40`;
    const experts = await sql<Array<{ expert: string; values_summary: string | null; heuristics: unknown; risk_posture: string | null; source: string | null }>>`
      select expert, values_summary, heuristics, risk_posture, source from expert_profile order by expert`;
    if (!rules.length && !experts.length) return "";

    const lines: string[] = ["", "LOT DISTILLED KNOWLEDGE (from cited sources — cite the rule slug / expert when you lean on one; it is informational, not legal/financial advice):"];
    if (rules.length) {
      lines.push("", "Creative-finance & deal rules:");
      for (const r of rules) {
        lines.push(`- [${r.slug ?? "rule"}] WHEN ${r.condition} → ${r.recommendation} (${r.confidence}${r.source ? `, src: ${r.source}` : ""})`);
      }
    }
    if (experts.length) {
      lines.push("", "Expert lenses:");
      for (const e of experts) {
        const hs = Array.isArray(e.heuristics) ? (e.heuristics as unknown[]).slice(0, 4).map((h) => String(h)).join("; ") : "";
        lines.push(`- ${e.expert} — ${e.values_summary ?? ""}${hs ? ` Heuristics: ${hs}.` : ""}${e.risk_posture ? ` Risk: ${e.risk_posture}.` : ""}`);
      }
    }
    return lines.join("\n");
  } catch {
    return "";   // knowledge unavailable → agent still runs on its base prompt
  }
}
