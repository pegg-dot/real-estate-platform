# Knowledge Brain — Phase 1a: Faithful Distillation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing (never-run) distillation pipeline ON against the full podcast transcripts so LOT's knowledge layer holds the *faithful, reasoning-rich* playbook instead of ~22 hand-curated snippets — and make that new depth reach the engine's LLM agents, with a fidelity regression guarding it.

**Architecture:** The pipeline already exists and works: `lib/knowledge/extract.ts` (`llmExtractor`, gated on `ANTHROPIC_API_KEY` — now set) → `lib/knowledge/distill.ts` (`diffArtifacts`, conflict-aware) → `lib/db/knowledge.ts` (`storeArtifacts`, handles rule/exemplar/param/concept). We (1) strengthen the extraction prompt to capture reasoning/frameworks/open-questions as rich `concept` artifacts, (2) complete the diff baseline so re-ingestion is correctly idempotent, (3) run distillation over both `Sources/*.md` transcripts, (4) add a fidelity regression eval, and (5) surface the new concepts to the agents via `knowledgePreamble`. **pgvector semantic retrieval is deliberately NOT in this plan** — it needs an embedding provider (Anthropic has none); that decision is an open question (spec 028 §7) and becomes Phase 1b.

**Tech Stack:** TypeScript (NodeNext, `.js` import extensions), Vitest, `ai` SDK v6 + `@ai-sdk/anthropic`, Postgres (`postgres` lib) on Supabase. Root engine in `lib/` + `scripts/`; tests are `lib/**/*.test.ts`. DB-gated tests run only when `TEST_DATABASE_URL` is set (mirror the `lib/pipeline/scoreMarket.test.ts` pattern).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `lib/knowledge/extract.ts` | LLM extraction prompt + schema | Modify (strengthen prompt; richer concept capture) |
| `lib/db/knowledge.ts` | Artifact load/store | Modify (`loadArtifacts` to include rules + notes) |
| `lib/agent/preamble.ts` | **NEW** pure preamble builder (extracted from `knowledge.ts`) | Create |
| `lib/agent/preamble.test.ts` | Unit tests for the pure builder | Create |
| `lib/agent/knowledge.ts` | DB-loading wrapper that calls the pure builder | Modify (delegate to `renderPreamble`, add concepts query) |
| `lib/knowledge/fidelity.test.ts` | **NEW** DB-gated fidelity regression eval | Create |
| `lib/db/knowledge.test.ts` | Existing DB-gated knowledge tests | Modify (add `loadArtifacts` baseline test) |

---

## Task 1: Complete the diff baseline so rules + concepts are seen

**Why:** `loadArtifacts` currently returns only `param` + `exemplar` rows (`lib/db/knowledge.ts:57-66`). On re-distillation, every rule/concept therefore looks "new" and cross-source *rule* conflicts can never surface. Completing the baseline makes re-ingestion idempotent and conflict-aware for all kinds.

**Files:**
- Modify: `lib/db/knowledge.ts:57-66`
- Test: `lib/db/knowledge.test.ts`

- [ ] **Step 1: Write the failing test** (append to `lib/db/knowledge.test.ts`, inside the existing DB-gated `describe`)

```typescript
it("loadArtifacts returns rules and concept-notes in the diff baseline", async () => {
  await sql`insert into knowledge_rule (slug, condition, recommendation, confidence, source)
    values ('t#r1', 'when X', 'do Y', 'real'::confidence_level, 'unit-test')
    on conflict (slug) do update set recommendation = excluded.recommendation`;
  await sql`insert into knowledge_note (title, body, source) values ('t-concept', 'a framework body', 'unit-test')
    on conflict (title, source) do update set body = excluded.body`;
  const arts = await loadArtifacts(sql);
  expect(arts.find((a) => a.kind === "rule" && a.key === "t#r1")?.value).toBe("do Y");
  expect(arts.find((a) => a.kind === "rule" && a.key === "t#r1")?.condition).toBe("when X");
  expect(arts.find((a) => a.kind === "concept" && a.key === "t-concept")?.value).toBe("a framework body");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `TEST_DATABASE_URL=$SUPABASE_DB_URL npx vitest run lib/db/knowledge.test.ts -t "diff baseline"`
Expected: FAIL — `loadArtifacts` returns no `rule`/`concept` artifacts (find → undefined).

- [ ] **Step 3: Write minimal implementation** — extend `loadArtifacts` in `lib/db/knowledge.ts` (after the `exemplars` query, before the `return`)

```typescript
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
```
(Remove the old two-element `return [...]` it replaces.)

- [ ] **Step 4: Run test to verify it passes**

Run: `TEST_DATABASE_URL=$SUPABASE_DB_URL npx vitest run lib/db/knowledge.test.ts -t "diff baseline"`
Expected: PASS. Also run `npm run typecheck` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/db/knowledge.ts lib/db/knowledge.test.ts
git commit -m "fix(knowledge): include rules + concept-notes in the distillation diff baseline"
```

---

## Task 2: Extract a pure preamble builder + surface concepts to the agents

**Why:** `knowledgePreamble` (`lib/agent/knowledge.ts`) only injects rules + experts — the rich `knowledge_note` concepts (the frameworks, the reasoning) never reach the LLM agents. The string-building is also un-unit-tested. Extract a pure `renderPreamble()` (testable), add a concepts section, and have the DB wrapper load top notes.

**Files:**
- Create: `lib/agent/preamble.ts`
- Create: `lib/agent/preamble.test.ts`
- Modify: `lib/agent/knowledge.ts`

- [ ] **Step 1: Write the failing test** — `lib/agent/preamble.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { renderPreamble } from "./preamble.js";

describe("renderPreamble (pure)", () => {
  it("returns '' when there is no knowledge", () => {
    expect(renderPreamble({ rules: [], experts: [], concepts: [] })).toBe("");
  });

  it("renders a cited concepts section when concepts are present", () => {
    const out = renderPreamble({
      rules: [],
      experts: [],
      concepts: [{ title: "today/tomorrow/forever money", body: "categorize every deal by when it pays.", source: "pace-morby" }],
    });
    expect(out).toContain("Frameworks & concepts");
    expect(out).toContain("today/tomorrow/forever money");
    expect(out).toContain("pace-morby");
  });

  it("renders rules with slug, condition, recommendation, source", () => {
    const out = renderPreamble({
      rules: [{ slug: "cf#sub2", condition: "low equity, behind on payments", recommendation: "subject-to", confidence: "modeled", source: "pace-morby" }],
      experts: [], concepts: [],
    });
    expect(out).toContain("[cf#sub2]");
    expect(out).toContain("subject-to");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/agent/preamble.test.ts`
Expected: FAIL — `Cannot find module './preamble.js'`.

- [ ] **Step 3: Write minimal implementation** — `lib/agent/preamble.ts`

```typescript
/** Pure builder for the agent knowledge preamble (testable). The DB wrapper in knowledge.ts loads
 * the rows; this turns them into the cited prompt block. Concepts (knowledge_note frameworks) are
 * surfaced alongside rules + expert lenses so the distilled reasoning actually reaches the agent. */
export interface PreambleRule { slug: string | null; condition: string; recommendation: string; confidence: string; source: string | null }
export interface PreambleExpert { expert: string; values_summary: string | null; heuristics: unknown; risk_posture: string | null; source: string | null }
export interface PreambleConcept { title: string; body: string; source: string | null }

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/agent/preamble.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Rewire `lib/agent/knowledge.ts` to load concepts + delegate to the pure builder**

Replace the body of `knowledgePreamble` with:

```typescript
import type { Sql } from "../db/client.js";
import { renderPreamble, type PreambleRule, type PreambleExpert, type PreambleConcept } from "./preamble.js";

export async function knowledgePreamble(sql: Sql): Promise<string> {
  try {
    const rules = await sql<PreambleRule[]>`
      select slug, condition, recommendation, confidence::text as confidence, source from knowledge_rule order by confidence desc, slug limit 40`;
    const experts = await sql<PreambleExpert[]>`
      select expert, values_summary, heuristics, risk_posture, source from expert_profile order by expert`;
    const concepts = await sql<PreambleConcept[]>`
      select title, left(body, 400) as body, source from knowledge_note order by length(body) desc limit 12`;
    return renderPreamble({ rules, experts, concepts });
  } catch {
    return "";   // knowledge unavailable → agent still runs on its base prompt
  }
}
```

- [ ] **Step 6: Verify nothing else broke**

Run: `npm run typecheck && npx vitest run lib/agent/preamble.test.ts`
Expected: tsc exit 0; tests PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/agent/preamble.ts lib/agent/preamble.test.ts lib/agent/knowledge.ts
git commit -m "feat(knowledge): surface distilled concepts to agents via a tested pure preamble builder"
```

---

## Task 3: Strengthen the extraction prompt to capture reasoning faithfully

**Why:** The current `SYSTEM` prompt (`lib/knowledge/extract.ts:23-32`) biases toward rules/params/objection-exemplars and under-captures the *reasoning* — the frameworks ("today/tomorrow/forever money"), mental models (the "Bunnies" lesson, "exit strategies aren't deal sources"), worked deal math, and the source's own "open questions / what's new" notes. Those belong in rich `concept` artifacts (→ `knowledge_note`). This is a prompt (config-like) change; its real guard is the fidelity eval in Task 4.

**Files:**
- Modify: `lib/knowledge/extract.ts:23-32`

- [ ] **Step 1: Replace the `SYSTEM` constant** in `lib/knowledge/extract.ts`

```typescript
const SYSTEM = `You distill a real-estate investing transcript/book into structured, CITED knowledge.
Extract ONLY what the source actually says — never invent. Be FAITHFUL and THOROUGH: capture the
reasoning, not just conclusions. Produce:
- concepts: the source's FRAMEWORKS, mental models, definitions, and reasoning chains, each as a
  self-contained explanation (key = a short slug like 'today-tomorrow-forever-money'; value = a full
  multi-sentence explanation in the source's own logic). ALSO capture the source's explicit
  "open questions / things to verify / what's new vs last time" as concepts. Favor MANY rich
  concepts over few — this is where the playbook's depth lives.
- rules: condition -> recommendation (creative-finance/structure/strategy heuristics), confidence-tagged.
- exemplars: how the expert COMMUNICATES — objection->response (key 'objection#...') and
  situation->framing (key 'situation#...'); value = the verbatim framing.
- params: named numeric calibrations (cost_to_sell_pct, mtr_multiplier, stale_on_market_days, etc.)
  as snake_case keys with the value as a string.
Capture EVERY distinct play/strategy the source names (wholesale, novation, subject-to, seller-finance,
hybrid/"Morby" debt plays, gap/transactional funding, BRRRR, lease options, etc.) — as a concept
(what/when/why) and, where it gives a heuristic, a rule. Tag confidence by how firmly the source
asserts each item. Legal/financial claims stay as the source's OPINION — never settled fact.`;
```

- [ ] **Step 2: Verify it still typechecks** (the schema is unchanged; only the prompt string changes)

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/knowledge/extract.ts
git commit -m "feat(knowledge): extraction prompt captures full reasoning/frameworks, not just rules"
```

---

## Task 4: Run the distillation over the full transcripts (data operation)

**Why:** This is the actual "switch it on." With `ANTHROPIC_API_KEY` set, `ingest-source.ts` routes `.md` through `llmExtractor`. Run it for both transcripts and verify a large jump in stored knowledge.

**Files:** none changed (this runs the pipeline). Requires `ANTHROPIC_API_KEY` + `SUPABASE_DB_URL` in env, and a free DB connection (kill the dev server first if the 15-client pooler is saturated: `lsof -ti:3000 | xargs kill -9`).

- [ ] **Step 1: Capture the BEFORE counts**

```bash
set -a && . ./.env && set +a
# (one-shot count via a temp tsx IIFE, or psql) — record rows in knowledge_note / knowledge_rule / knowledge_exemplar / knowledge_param
```
Expected (pre-run): a handful (notes from `ingest-concepts`, ~7 rules, ~few exemplars/params).

- [ ] **Step 2: Dry-run the first transcript (no --apply) and read the diff**

Run: `npm run ingest-source -- docs/knowledge-base/Sources/pace-morby--four-ways-to-make-money.md`
Expected: prints "What I learned…" with a LARGE `new` count (many concepts), some rules/exemplars, ideally 0–few conflicts. Eyeball 5–10 NEW concept keys — confirm they read as faithful reasoning, not slogans.

- [ ] **Step 3: Apply both transcripts**

```bash
npm run ingest-source -- docs/knowledge-base/Sources/pace-morby--four-ways-to-make-money.md --apply
npm run ingest-source -- docs/knowledge-base/Sources/grant-cardone-pace-morby--creative-finance.md --apply
```
Expected: `✓ stored N` for each; conflicts held back (not auto-merged). Note the AFTER counts — `knowledge_note` should jump from a handful to dozens.

- [ ] **Step 4: Spot-check fidelity manually** — query 3 stored notes and confirm they capture the source's reasoning (e.g. a "today/tomorrow/forever money" concept, an "exit strategies aren't deal sources" concept, a "novation" play). If any key framework is missing, refine the Task 3 prompt and re-run Step 2–3 (idempotent — re-applying is safe).

- [ ] **Step 5: Commit** (no code; record the run outcome in the plan/notes if desired — nothing to stage unless counts are logged to a doc)

```bash
# no-op commit unless you log results; otherwise skip to Task 5
```

---

## Task 5: Fidelity regression eval (the guard)

**Why:** spec 028 §6 requires a regression corpus — questions whose cited answers must trace to the source. This locks in faithfulness so a future re-distillation that drops a key framework fails CI.

**Files:**
- Create: `lib/knowledge/fidelity.test.ts`

- [ ] **Step 1: Write the DB-gated fidelity test** — `lib/knowledge/fidelity.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getSql, type Sql } from "../db/client.js";

const DSN = process.env.TEST_DATABASE_URL ?? process.env.SUPABASE_DB_URL;
const d = DSN ? describe : describe.skip;

// Each entry: a framework/play the transcripts unambiguously teach. After faithful distillation it
// MUST be findable in the knowledge store (note OR rule OR exemplar). A miss = lost fidelity.
const MUST_TRACE: Array<{ what: string; needle: string }> = [
  { what: "today/tomorrow/forever money framing", needle: "forever" },
  { what: "exit strategies are not deal sources", needle: "exit strateg" },
  { what: "subject-to play", needle: "subject" },
  { what: "novation play", needle: "novation" },
  { what: "seller finance play", needle: "seller financ" },
  { what: "the 'bunnies' / motivated-seller lesson", needle: "bunn" },
];

d("knowledge fidelity — the transcripts' core plays survived distillation", () => {
  let sql: Sql;
  beforeAll(() => { sql = getSql(DSN!); });
  afterAll(async () => { await sql.end(); });

  for (const { what, needle } of MUST_TRACE) {
    it(`retains: ${what}`, async () => {
      const [{ hits }] = await sql<Array<{ hits: number }>>`
        select (
          (select count(*) from knowledge_note where body ilike ${"%" + needle + "%"} or title ilike ${"%" + needle + "%"}) +
          (select count(*) from knowledge_rule where recommendation ilike ${"%" + needle + "%"} or condition ilike ${"%" + needle + "%"}) +
          (select count(*) from knowledge_exemplar where response ilike ${"%" + needle + "%"})
        )::int as hits`;
      expect(hits).toBeGreaterThan(0);
    });
  }
});
```

- [ ] **Step 2: Run it AFTER Task 4's distillation**

Run: `TEST_DATABASE_URL=$SUPABASE_DB_URL npx vitest run lib/knowledge/fidelity.test.ts`
Expected: PASS (all `MUST_TRACE` entries found). If one fails, the distillation missed that play → tighten the Task 3 prompt, re-apply (Task 4), re-run. Do NOT weaken the needle to make it pass.

- [ ] **Step 3: Commit**

```bash
git add lib/knowledge/fidelity.test.ts
git commit -m "test(knowledge): fidelity regression — core transcript plays must survive distillation"
```

---

## Out of scope (explicit — next plans)

- **pgvector semantic retrieval (Phase 1b):** blocked on an embedding-provider decision (Anthropic has no embeddings API; options = OpenAI `text-embedding-3-small` (1536-dim, matches the schema), Voyage, or local). Resolve with Nate, then a follow-up plan populates `knowledge_note.embedding` + adds semantic `searchKnowledge`.
- **The play registry (Phase 2 input):** collapsing the three hardcoded strategy unions into one data-driven registry — its own plan; informed by the concepts this plan distills.
- **Wiring the web Explainer to retrieval:** the web chat route has no DB/tools; that's part of the conversation-door reshape (Phase 3).

## Self-Review

- **Spec coverage (028 §3.1):** faithful re-distillation ✓ (Tasks 3–4); reasoning-not-just-rules ✓ (Task 3 prompt + Task 5 eval); compounding/conflict-aware store ✓ (existing `diffArtifacts`, baseline completed in Task 1); surface to copilot ✓ (Task 2). Retrieval ✓ explicitly deferred with reason. Play registry ✓ deferred. §6 fidelity regression ✓ (Task 5).
- **Placeholder scan:** none — every step has exact code/commands.
- **Type consistency:** `Artifact` fields (kind/key/value/source/confidence/condition/asOf) match `distill.ts:14-25`; `renderPreamble` input types reused by `knowledge.ts`; `confidence_level` cast matches existing inserts.
