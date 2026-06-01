/**
 * Seed the knowledge_rule table — the curated rules the financing engine cites. Run once
 * per refresh so every recommendation's `citedRules` resolves to real, auditable text
 * (condition / recommendation / source) the deal modal can display.
 */
import type { Sql } from "./client.js";
import rulesSeed from "../../config/knowledge/creative-finance-rules.json" with { type: "json" };

export async function seedKnowledgeRules(sql: Sql): Promise<number> {
  for (const r of rulesSeed.rules) {
    await sql`
      insert into knowledge_rule (slug, condition, recommendation, confidence, source)
      values (${r.slug}, ${r.condition}, ${r.recommendation},
              ${r.confidence}::confidence_level, ${r.source})
      on conflict (slug) do update set
        condition = excluded.condition, recommendation = excluded.recommendation,
        confidence = excluded.confidence, source = excluded.source, updated_at = now()
    `;
  }
  return rulesSeed.rules.length;
}

/** Resolve cited rule slugs to their full text (for a dossier / deal modal). */
export async function resolveRules(sql: Sql, slugs: string[]): Promise<
  { slug: string; condition: string; recommendation: string; source: string }[]> {
  if (slugs.length === 0) return [];
  return sql`
    select slug, condition, recommendation, source
    from knowledge_rule where slug = any(${sql.array(slugs)})`;
}
