/** Pure builder for the agent knowledge preamble (testable). The DB wrapper in knowledge.ts loads
 * the rows; this turns them into the cited prompt block. Concepts (knowledge_note frameworks) are
 * surfaced alongside rules + expert lenses so the distilled reasoning actually reaches the agent. */
export interface PreambleRule { slug: string | null; condition: string; recommendation: string; confidence: string; source: string | null }
export interface PreambleExpert { expert: string; values_summary: string | null; heuristics: unknown; risk_posture: string | null; source: string | null }
export interface PreambleConcept {
  title: string;
  /** May be SQL-truncated (left(body, 400) in the DB query). */
  body: string;
  source: string | null;
}

export function renderPreamble(k: { rules: PreambleRule[]; experts: PreambleExpert[]; concepts: PreambleConcept[] }): string {
  if (!k.rules.length && !k.experts.length && !k.concepts.length) return "";
  const lines: string[] = ["", "LOT DISTILLED KNOWLEDGE (from cited sources — cite the rule slug / concept / expert when you lean on one; it is informational, not legal/financial advice):"];
  if (k.concepts.length) {
    lines.push("", "Frameworks & concepts:");
    for (const c of k.concepts) lines.push(`- ${c.title}: ${c.body}${c.source ? ` (src: ${c.source})` : ""}`);
  }
  if (k.rules.length) {
    lines.push("", "Creative-finance & deal rules:");
    for (const r of k.rules) lines.push(`- [${r.slug ?? "rule"}] WHEN ${r.condition} → ${r.recommendation} (${r.confidence}${r.source ? `, src: ${r.source}` : ""})`);
  }
  if (k.experts.length) {
    lines.push("", "Expert lenses:");
    for (const e of k.experts) {
      const hs = Array.isArray(e.heuristics) ? (e.heuristics as unknown[]).slice(0, 4).map(String).join("; ") : "";
      lines.push(`- ${e.expert} — ${e.values_summary ?? ""}${hs ? ` Heuristics: ${hs}.` : ""}${e.risk_posture ? ` Risk: ${e.risk_posture}.` : ""}`);
    }
  }
  return lines.join("\n");
}
