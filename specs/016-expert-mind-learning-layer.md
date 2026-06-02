# Spec 016 — Expert-Mind Learning Layer (continuous distillation) ⭐ THE COMPOUNDING MOAT

**Status:** ready to build · **Depends on:** existing `lib/db/knowledge.ts` (store) + `lib/learn/*`
(outcome loop) · feeds 003/004/007/009/014/015 · **Unlocks:** "the more sources you feed it, the
better everything gets."

## The idea (and the honest engineering)
As we feed more podcasts/books (Pace Morby + other operators), the system should internalize *how
these experts think, talk, value, decide* and improve **everything**. We **distill, we don't
fine-tune** (weights can't be cited or updated per source — disqualifying for a money/legal
product). Each source → structured, cited, queryable knowledge that every module retrieves and an
outcome loop re-weights.

## Reality check — reuse what's shipped (read before building)
| Concept | Already built | Reuse plan |
|---|---|---|
| Knowledge store | ✅ `lib/db/knowledge.ts` (+ test, migrations) | **Extend it** — add exemplar/param/persona tables; don't create a parallel store |
| Outcome re-weighting | ✅ `lib/learn/{retune,divergence,taxonomy}.ts` (spec 011 LEARN loop, human-gated ~40 decisions) | **Reuse the retuner** to re-weight knowledge rows, not just thesis weights — don't rebuild the loop |
| Per-recommendation citations | ✅ pattern exists (knowledge cited) | Extend citations to exemplars/params |
| Rules/notes | ✅ `knowledge_rule`/`knowledge_note` | Add the new artifact types alongside |

Net: the **store** and the **outcome loop** exist. Genuinely new = the **distillation pipeline**,
**exemplars/params/personas**, and **wiring retrieval into the reasoning modules**.

## What each source becomes (the distillation pipeline — NEW)
Drop a transcript/book → extraction produces, all attributed (`source`/`speaker`/`as_of`) +
`confidence`-tagged:
1. **Rules** — `condition → recommendation → confidence → citation` (extend `knowledge_rule`).
2. **Exemplars** (NEW `knowledge_exemplar`) — how the expert communicates: objection→response,
   situation→framing, the bunny stories. Few-shot fuel for the coach (015).
3. **Parameter calibrations** (NEW `knowledge_param`) — cost-to-sell ~10%, wholesale ~50¢/$,
   MTR 1.3–1.5×, "100+ days" thresholds. Feeds scoring (003) + exit strategies (007 Part A) +
   `lib/config/assumptions.ts` (override defaults with cited, source-backed values).
4. **Concepts/vocabulary** — glossary/acronyms → NL filters.
5. **Expert-persona profile** (NEW `expert_profile`) — values, heuristics, risk posture, voice;
   enables "what would <expert> do" + blending/comparing experts.

## Wiring into every module (the point)
- **003 scoring** ← `knowledge_param` calibrations + weight priors (via `lib/config/assumptions.ts`).
- **004 financing** ← structure-mapping rules + cap-gains/persuasion exemplars.
- **007/009/014 motivation+situation** ← motivation→bunny→structure mappings + outreach exemplars
  (thread through `lib/enrich/situation.ts`).
- **015 coach** ← objection→response exemplars + persona profiles for roleplay.
- Every module **cites** the rules/exemplars/params it used.

## The outcome loop (reuse `lib/learn/*`)
Extend the existing retuner so accept/reject/close signals (already captured for thesis weights)
**also** up/down-weight the knowledge rows that drove a recommendation — auditable `weight_change`
log, human-gated, same as today. This is preference learning over **knowledge weights**, not model
weights.

## Ingest UX
`npm run ingest-source <file>` (or a chat drop): run the pipeline, show a **"what I learned" diff**
(new rules/exemplars/params, conflicts flagged — never silent overwrite), commit on approval.
Re-distill the Pace Morby source already in `docs/knowledge-base/`.

## Implementation plan (build order)
1. **Migration**: `knowledge_exemplar`, `knowledge_param`, `expert_profile` (+ pgvector embeddings)
   alongside the existing knowledge tables; conflict fields (source/speaker/as_of/confidence/corroboration).
2. **Distillation pipeline** (`lib/knowledge/distill.ts`) + `scripts/ingest-source.ts` with the diff UX.
3. **Retrieval wiring** into `lib/config/assumptions.ts` (params), `lib/financing/recommend.ts`
   (rules/exemplars), `lib/enrich/situation.ts` (mappings) — all cited.
4. **Outcome loop**: extend `lib/learn/retune.ts` to re-weight knowledge rows (reuse the gate).
5. **Personas** + blend/compare; expose to 015's roleplay.

## Acceptance criteria (tests)
- Ingesting a transcript yields ≥1 rule/exemplar/param/concept, all attributed + confidence-tagged;
  a conflicting second source is flagged (no overwrite).
- A scoring run cites the params it used; a financing rec cites its rules; (later) a coach script
  cites its exemplars.
- An accept/reject signal changes the affected knowledge weights via the existing retuner with a
  logged rationale; a re-run reflects it.
- An expert profile is queryable and blendable; the ingest diff is shown and is idempotent.

## Honest flags
Distilled knowledge is *opinion from a source*, always cited + confidence-tagged. Conflicts surfaced,
not silently resolved. Legal/financial claims still route through 004's guardrails regardless of what
a guru said. Makes the system *more like Nate's chosen experts over time* — transparently, reversibly.
