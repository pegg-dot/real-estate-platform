# 028 — The Adaptive Brain: from opinionated scorer to a market you can learn

> **Status:** Design approved (brainstorm), pending spec review → implementation plan.
> **Date:** 2026-06-04
> **Supersedes the framing of:** the by-the-room default baked across 019/020/021/024/025.
> This is a *vision/design* spec. Each phase below becomes its own numbered build spec (029+).

## 1. The reframe

LOT was built as an **opinionated scoring machine** that assumes one answer: by-the-room (BTR)
student rentals, financed with a fixed handful of structures. Nate — the actual user — starts
knowing **nothing** about the Charlottesville–UVA market, and wants the opposite: a tool he can
**learn the market through**, that captures the **full** creative-finance / strategy playbook from
the podcasts he feeds it, and that **adapts** as *his* thesis emerges instead of hardcoding one.

**The product becomes one copilot brain** — fed by sources (podcasts/docs), fluent in every play,
wired to real Charlottesville parcels — that the user *talks to, looks through, and learns from*
until a thesis emerges and bends every lens to it.

Four pieces, built **knowledge-first**:

1. **The Brain** — a faithful, compounding knowledge layer that is the source of truth for plays.
2. **Strategy as a plural lens** — de-hardcode BTR; the user's thesis selects which plays apply.
3. **The emergent thesis** — forms from what the user says *and does*; steers every lens.
4. **The experience** — one brain surfaced through three woven "doors": conversation, map, notebook.

## 2. Why now — what the audit found (grounding)

The engine is **two-layered and inconsistent**: a newer *pluggable* strategy menu sits demoted
underneath an older *hardcoded* by-room headline.

- **Strategy plumbing already exists** but is buried as a secondary annotation:
  - `lib/scoring/exitStrategy.ts:17` — operate models: `ltr | by_room | mtr | str | section8 | assisted`.
  - `lib/scoring/hbu.ts:20` — uses of the dirt: `hold | flip | develop | wholesale`.
  - `lib/financing/recommend.ts:10` — capital: `cash | conventional | seller_finance | subject_to | hybrid | wraparound`.
- **The headline is hardcoded** to a 2-model duel and is what the whole app ranks/maps on:
  - `lib/scoring/score.ts:31` — `headline.model` admits only `by_room | whole_house`.
  - `score.ts:74-82` — `useByRoom = byRoom.coc >= wholeHouse.coc`; nothing else competes.
  - `score.ts:38` — UVA Rotunda lat/lng baked in; `score.ts:48-52,95` — appreciation & a scoring
    component *defined as* distance-to-campus; `score.ts:89-105` — fixed student-rental component keys.
  - `supabase/migrations/0002_…:17` — `headline_model` is a 2-value genome column.
  - `lib/thesis/schema.ts:12-29` — `ScoringWeights` is a **closed 8-key student-rental object**;
    `config/thesis.example.json:28,43-51` seeds `rental_model_default: by_the_room` + BTR weights.
    `goal.type` lists `flip|brrrr` (`schema.ts:46-47`) but **`score.ts` never reads it** — inert.
- **Knowledge is compressed, not faithful.** ~5,700 words of Pace/Grant transcripts
  (`docs/knowledge-base/Sources/*.md`) were **hand-curated** into ~22 artifacts + 7 rules
  (`config/knowledge/*.json`). The LLM distiller `lib/knowledge/extract.ts` **was never run**
  (credit-gated, `scripts/ingest-source.ts:49-57`). Retrieval is crude SQL `ilike` substring
  (`lib/agent/tools.ts:69-72`) — **no pgvector** despite being in-stack. The most-used chat agent,
  the **Explainer** (`web/app/api/chat/route.ts:15-37`), has **zero retrieval** — its knowledge is a
  frozen prompt string. `web/app/playbook/page.tsx` is a **hand-typed duplicate** of the corpus,
  only 6 finance plays, no citations.
- **The thesis is adaptive in plumbing, static in lens.** Versioned + learnable
  (`lib/db/thesis.ts`, `lib/learn/*`), but its vocabulary is frozen to BTR; it cannot make
  BRRRR/flip/STR the headline or add a scoring dimension.

**Implication:** de-hardcoding is mostly *promote the existing menu to the headline + de-bias the
thesis + relabel the UI* — not a ground-up rebuild. The genuinely new build is **the faithful
knowledge brain** and **the woven experience**.

## 3. The design

### 3.1 The Brain (knowledge layer) — faithful + compounding + authoritative

- **Faithful re-distillation.** Run the existing LLM distillation path over the *full* `Sources/*`
  transcripts (and future-fed sources), capturing **reasoning, not just rules**: the plays, when
  they apply, *why*, objection→response chains, real deal math, the expert's framing (e.g. Pace's
  "exit strategies aren't deal sources", "today/tomorrow/forever money", the Bunnies lesson), each
  with **attribution + confidence + the source's own open-questions/what's-new notes**. The
  well-designed schema (`lib/knowledge/distill.ts` conflict/corroboration) is kept; it was simply
  never fed.
- **One strategy/play registry, emergent from the knowledge.** Collapse the three disjoint
  hardcoded unions into a single registry of **plays** keyed by kind — `acquire | operate | finance
  | exit` — each carrying: `what`, `when_it_fits`, `reasoning`, `math_model` (the underwriting
  hook), `legal_guardrails`, `citations`. Feeding a podcast that teaches **novation** or the
  **Morby debt method** *adds a play*. This is the compounding loop: knowledge in → capability out.
  Missing plays to add (from audit §B): novation, lease options, gap/transactional funding, BRRRR
  as a primary lens, wholesale-as-headline, hybrid debt variants beyond the single `hybrid`.
- **Real retrieval.** pgvector embeddings + reranker (the CLAUDE.md progression:
  full-context+caching → pgvector → GraphRAG only on proven multi-hop failure). The copilot pulls
  the right reasoning on demand; **everything cites its source.** The Explainer gains retrieval.

### 3.2 Strategy as a plural lens (de-hardcode)

- **Promote the menu to the headline.** Replace `score.ts`'s 2-model duel with "score every
  *thesis-enabled* play and the headline = the winner for this thesis." (The exit/HBU optimizers
  already prove the pattern; this lifts it to the primary score.)
- **De-bias the thesis vocabulary.** `ScoringWeights` becomes **thesis-declared dimensions**, not a
  fixed 8-key student union. `campus_proximity` becomes one *optional* dimension; appreciation stops
  being defined as campus distance by default. `goal.type` (flip/brrrr/…) actually drives scoring.
- **Generalize the genome.** `headline_model` (2-value) → a strategy id referencing the registry.
- **A lens selector** across the app: the user picks which plays they're viewing through; map,
  scores, and cards re-render to that lens. BTR appears only when the user selects it.

### 3.3 The emergent thesis

- The thesis becomes a **living profile** fed by (a) what the user **says** (prose intake stays) and
  (b) what the user **does** (advance/pass calls, dwell, saves-to-notebook — the existing learn loop
  `lib/learn/*`, generalized off a single weight-vector). Versioned + learnable already; we make its
  **content adaptive** so it can hold multiple lenses ("BTR here, BRRRR there") and **steers every
  lens automatically.**

### 3.4 The experience — one brain, three doors

Spine = the copilot intelligence. Three woven surfaces, no modes:

- **Conversation** *(reshape `web/app/chat`)* — ask anything; it answers **and renders real
  parcels/maps/strategy-compares inline**, cited. The scattered agents (Explainer/Operator/
  Interrogator/Coach/Analyst…) collapse into **one copilot** with retrieval + tools.
- **Map / workspace** *(reshape `web/app/map`)* — real ground with the copilot riding along,
  teaching the plays for what's in view; lens selector present. Kill the fake static
  `thesis · UVA by-room` chip (`map/page.tsx:149`).
- **Notebook** *(reshape `web/app/learn` + thesis editing)* — questions, pinned parcels, strategy
  compares, and realizations **accumulate**; the **thesis crystallizes here** and flows back out.

**Page disposition** (full map; almost nothing retired):

| Page | Verdict | Note |
|---|---|---|
| Map | RESHAPE | → map door; lens architecture already present; kill BTR chip |
| Chat | RESHAPE | → conversation door; one copilot w/ retrieval + citations |
| Thesis | RESHAPE ⭐ | → notebook; emergent + plural-lens; de-bias schema |
| Playbook | RESHAPE/MERGE | living, cited, data-driven off the real corpus; full play menu |
| Learn | KEEP→Notebook | the emergent-thesis engine; generalize off single weight-vector |
| Rents | RESHAPE | strategy-plural comps (MTR/STR/Sec8), feed the brain; not $/bed-only |
| Brief | RESHAPE/MERGE | lens-aware "what needs attention"; can surface via copilot |
| Radar | KEEP+reshape | surface `str_allowed` + per-strategy legality; de-hardcode market |
| Changes | KEEP | generalize `by_room_legality_change` to per-strategy |
| Portfolio / Leads / Pipeline | KEEP (light) | already mostly strategy-neutral; drop BTR copy/chips |
| Outreach / Schedule / Activity / Settings·Run | KEEP | action/ops; copilot-invokable; parameterize market+lens |

## 4. Build phasing (knowledge-first; each phase ships usable)

- **Phase 1 — The Brain (spec 029).** Faithful re-distillation of the corpus + the play registry +
  pgvector retrieval, wired into the copilot. The Explainer gains cited retrieval; Playbook becomes
  data-driven. **Done = ask LOT about any play, get the real cited full reasoning; the strategy menu
  is defined by the knowledge, not hardcoding.**
- **Phase 2 — Strategy as a lens (spec 030).** Promote the menu to the headline; de-bias the thesis
  schema + genome; lens selector; relabel. **Done = the app stops assuming by-room; the user
  chooses lenses and map/score/cards follow.**
- **Phase 3 — The three doors (spec 031).** Weave conversation↔map↔notebook into one motion
  (inline data rendering, riding map copilot, accumulating notebook).
- **Phase 4 — Adaptive thesis loop (spec 032).** Thesis forms from behavior + notebook, steers
  everything, compounds as the user feeds more sources.

## 5. Guardrails & non-goals (unchanged from the golden rules)

- Creative-finance **legal guardrails stay first-class**: due-on-sale / Dodd-Frank-SAFE /
  Garn-St-Germain caveats, "see an attorney" triggers, "informational, not legal/financial advice."
  A creative structure with no guardrail is still **refused** (`recommend.ts:164-169`).
- Outreach stays **mail-first + CAN-SPAM + DNC/opt-out**; propose-and-confirm everywhere; read-only
  SQL boundary preserved.
- **Not** in scope here: multi-market expansion (parked), national parcel acquisition, paid
  scraping. The de-hardcode *parameterizes* market but does not build a second market.

## 6. Testing strategy

- TDD per CLAUDE.md. The play registry, the multi-strategy headline selector, the de-biased thesis
  schema, and the distillation/retrieval are all **pure-where-possible + unit-tested** (the engine's
  existing `lib/**/**.test.ts` pattern). Knowledge fidelity gets a **regression corpus**: a set of
  questions whose cited answers must trace to the source transcripts.

## 7. Open questions (resolve during per-phase specs)

- Embedding model + reranker choice and cost envelope for retrieval.
- Whether the play registry is config-as-data (JSON/DB) or code; leaning **data** so feeding sources
  can extend it without a deploy.
- How "thesis holds multiple lenses per place/segment" is represented (single profile w/ scoped
  overrides vs. multiple active theses).
- Notebook persistence model (new table) and how it feeds the learn loop.
