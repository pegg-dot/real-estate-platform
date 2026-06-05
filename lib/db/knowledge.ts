/**
 * Seed the knowledge_rule table — the curated rules the financing engine cites. Run once
 * per refresh so every recommendation's `citedRules` resolves to real, auditable text
 * (condition / recommendation / source) the deal modal can display.
 */
import type { Sql } from "./client.js";
import rulesSeed from "../../config/knowledge/creative-finance-rules.json" with { type: "json" };
import personasSeed from "../../config/knowledge/grant-pace-personas.json" with { type: "json" };

/** Seed the two distilled expert_profile rows (Pace, Grant) used by spec 023's dual-persona engine.
 * Idempotent upsert keyed on `expert`. The interrogation engine reads the config directly (works
 * offline); this keeps the DB table in sync for the learn/LLM path + spec fidelity. */
export async function seedExpertProfiles(sql: Sql): Promise<number> {
  const experts = personasSeed.experts as Array<{
    expert: string; values_summary: string; heuristics: string[]; risk_posture: string;
    voice: string; confidence: string;
  }>;
  for (const e of experts) {
    await sql`insert into expert_profile (expert, values_summary, heuristics, risk_posture, voice, source, as_of, confidence)
      values (${e.expert}, ${e.values_summary}, ${sql.json(e.heuristics)}, ${e.risk_posture}, ${e.voice},
              ${personasSeed.source}, ${personasSeed.as_of}, ${e.confidence}::confidence_level)
      on conflict (expert) do update set values_summary = excluded.values_summary, heuristics = excluded.heuristics,
        risk_posture = excluded.risk_posture, voice = excluded.voice, source = excluded.source,
        as_of = excluded.as_of, confidence = excluded.confidence, updated_at = now()`;
  }
  return experts.length;
}

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

// ── Expert-mind knowledge artifacts (spec 016) ───────────────────────────────────────────────
import type { Artifact, DiffEntry } from "../knowledge/distill.js";
import type { ParamCandidate } from "../knowledge/retrieve.js";

/** Load the existing distilled artifacts (params + exemplars) as the diff baseline. */
export async function loadArtifacts(sql: Sql): Promise<Artifact[]> {
  const params = await sql<Array<{ name: string; value: string; source: string | null; confidence: string; as_of: string | null }>>`
    select name, value::text as value, source, confidence::text as confidence, to_char(as_of,'YYYY-MM-DD') as as_of from knowledge_param`;
  const exemplars = await sql<Array<{ key: string; response: string; source: string | null; confidence: string; as_of: string | null }>>`
    select key, response, source, confidence::text as confidence, to_char(as_of,'YYYY-MM-DD') as as_of from knowledge_exemplar`;
  const rules = await sql<Array<{ slug: string; condition: string; recommendation: string; source: string | null; confidence: string }>>`
    select slug, condition, recommendation, source, confidence::text as confidence from knowledge_rule`;
  const notes = await sql<Array<{ title: string; body: string; source: string | null }>>`
    select title, body, source from knowledge_note`;
  return [
    ...params.map((p): Artifact => ({ kind: "param", key: p.name, value: p.value, source: p.source ?? "", confidence: p.confidence as Artifact["confidence"], asOf: p.as_of })),
    ...exemplars.map((e): Artifact => ({ kind: "exemplar", key: e.key, value: e.response, source: e.source ?? "", confidence: e.confidence as Artifact["confidence"], asOf: e.as_of })),
    ...rules.map((r): Artifact => ({ kind: "rule", key: r.slug, value: r.recommendation, condition: r.condition, source: r.source ?? "", confidence: r.confidence as Artifact["confidence"], asOf: null })),
    ...notes.map((n): Artifact => ({ kind: "concept", key: n.title, value: n.body, source: n.source ?? "", confidence: "unknown" as Artifact["confidence"], asOf: null })),
  ];
}

/** Persist a distillation diff: stores new/updated/unchanged artifacts; SKIPS conflicts (those are
 * surfaced for human resolution, never auto-merged). Returns how many landed vs were held back. */
export async function storeArtifacts(sql: Sql, entries: DiffEntry[]): Promise<{ stored: number; conflicts: number }> {
  let stored = 0, conflicts = 0;
  for (const { artifact: a, status } of entries) {
    if (status === "conflict") { conflicts++; continue; }
    if (status === "unchanged") { stored++; continue; }
    const conf = (a.confidence) as string;
    if (a.kind === "param") {
      await sql`insert into knowledge_param (name, value, source, confidence, as_of)
        values (${a.key}, ${Number(a.value)}, ${a.source}, ${conf}::confidence_level, ${a.asOf ?? null})
        on conflict (name, source) do update set value = excluded.value, confidence = excluded.confidence, as_of = excluded.as_of, updated_at = now()`;
    } else if (a.kind === "exemplar") {
      await sql`insert into knowledge_exemplar (key, situation, response, source, confidence, as_of)
        values (${a.key}, ${a.key}, ${a.value}, ${a.source}, ${conf}::confidence_level, ${a.asOf ?? null})
        on conflict (key, source) do update set response = excluded.response, confidence = excluded.confidence, as_of = excluded.as_of, updated_at = now()`;
    } else if (a.kind === "rule") {
      // condition is the human-readable "when this applies"; the slug stays in `slug`, the
      // recommendation in `recommendation` (don't render a slug where a condition belongs).
      await sql`insert into knowledge_rule (slug, condition, recommendation, confidence, source)
        values (${a.key}, ${a.condition ?? a.value}, ${a.value}, ${conf}::confidence_level, ${a.source})
        on conflict (slug) do update set condition = excluded.condition, recommendation = excluded.recommendation, confidence = excluded.confidence, source = excluded.source, updated_at = now()`;
    } else { // concept -> note (deduped on title+source, see migration 0020)
      await sql`insert into knowledge_note (title, body, source) values (${a.key}, ${a.value}, ${a.source})
        on conflict (title, source) do update set body = excluded.body`;
    }
    stored++;
  }
  return { stored, conflicts };
}

/** Candidate cited values for a parameter (for resolveParamValue). */
export async function loadParamCandidates(sql: Sql, name: string): Promise<ParamCandidate[]> {
  const rows = await sql<Array<{ value: string; source: string | null; confidence: string; corroboration: number; weight: string; as_of: string | null }>>`
    select value::text as value, source, confidence::text as confidence, corroboration, weight::text as weight, to_char(as_of,'YYYY-MM-DD') as as_of
    from knowledge_param where name = ${name}`;
  return rows.map((r) => ({
    value: Number(r.value), source: r.source ?? "unknown", confidence: r.confidence as ParamCandidate["confidence"],
    corroboration: r.corroboration, weight: Number(r.weight), asOf: r.as_of,
  }));
}
