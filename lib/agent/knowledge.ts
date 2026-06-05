/**
 * Knowledge preamble (spec 022 + knowledge layer) — the compounding wire. Loads the distilled,
 * cited knowledge (rules, expert lenses, and now the rich `knowledge_note` frameworks/concepts) at
 * turn time and renders it via the pure builder in preamble.ts. Fails OPEN (returns "") so a
 * knowledge miss never breaks the agent.
 */
import type { Sql } from "../db/client.js";
import { renderPreamble, type PreambleRule, type PreambleExpert, type PreambleConcept } from "./preamble.js";

export async function knowledgePreamble(sql: Sql): Promise<string> {
  try {
    const rules = await sql<PreambleRule[]>`
      select slug, condition, recommendation, confidence::text as confidence, source from knowledge_rule order by confidence desc, slug limit 40`;
    const experts = await sql<PreambleExpert[]>`
      select expert, values_summary, heuristics, risk_posture, source from expert_profile order by expert`;
    const concepts = await sql<PreambleConcept[]>`
      select coalesce(title, '(untitled)') as title, left(body, 400) as body, source from knowledge_note order by length(body) desc limit 12`;
    return renderPreamble({ rules, experts, concepts });
  } catch {
    return "";   // knowledge unavailable → agent still runs on its base prompt
  }
}
