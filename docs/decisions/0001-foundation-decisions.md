# ADR 0001 — Foundation decisions before building specs 002 / 001

**Status:** accepted · **Date:** 2026-06-01 · **Deciders:** Nate, Claude Code

These are the five foundation decisions locked in before any feature code, so the
build stays spec-driven and the early choices don't get re-litigated mid-implementation.
They were proposed in the kickoff plan and approved.

---

## 1. Build ingest (002) before the Thesis Compiler (001)
**Decision:** Sequence is `002 → 001 → 003 → 004 → 005 → 006`, i.e. **data first**, even
though the specs are numbered 001 → 006.

**Why:** The architecture loop is SENSE → REASON → SHOW → LEARN. The Thesis Compiler
(001) and scoring (003) reason *about* property data; having real Charlottesville fields
in hand makes 001's questions and 003's math concrete instead of hypothetical. Matches
the kickoff "build 002 first" guidance and the dossiers, which are SENSE→REASON run by
hand.

**Consequence:** Spec numbers are priority/dependency labels, not build order. 001 still
ships before 003 (scoring needs the thesis).

## 2. Spec 001 ships as a headless library + CLI, not a UI
**Decision:** The Thesis Compiler is a pure TypeScript module (`lib/thesis/*`) plus a
thin CLI entry. **No questionnaire UI is built in 001.**

**Why:** The UI is spec 005's job (map + deal UI + NL filters). Building a thesis UI now
means building it twice — the "day-90 rewrite" trap the engineering plan warns about. The
existing `design/*.html` mockups are throwaway sketches (Nate's words) and are **not** the
design target; the real UI will be designed fresh later (Claude design / frontend-design).

**Consequence:** 001's acceptance tests assert on the structured `thesis.json` output and
the compile/validate logic, not on any rendered component.

## 3. Supabase live-load is env-gated, not a blocker
**Decision:** All transform / normalize / join / scoring-prep logic is TDD'd against
captured JSON fixtures and pure functions. The actual write to Supabase lives behind an
env-gated client (`SUPABASE_DB_URL` / service key) that no-ops or is skipped in tests.
The schema itself is provisioned now as a migration (see decision below).

**Why:** We can make real, tested progress on the engine before a Supabase project is
provisioned. The money/correctness logic must be unit-tested hard regardless of where it
writes. Nate will spin up the Supabase project before the load step actually persists.

**Consequence:** `ingestion/` separates pure `normalize.py` (fully tested offline) from
`load_supabase.py` (integration-tested only when creds are present).

## 4. `thesis.example.json` is a seed, not the schema
**Decision:** The validation contract is a real JSON Schema at
`config/thesis.schema.json`. `config/thesis.example.json` is a seed instance that must
validate against it.

**Why:** Specs 001 and 003 both depend on a stable thesis shape. A hand-written example
is not a contract — it can drift. The schema is the single source of truth both engines
code against.

**Consequence:** Spec 001 validates its output against this schema. The
"weights sum to 1.0" rule is enforced in code (JSON Schema can't express a cross-field
sum); the schema documents it. `risk_penalty_insurance_flood_condo` is stored as a
positive weight; its penalty sign is applied in the scoring engine (003), not the thesis.

## 5. Real-vs-modeled provenance is a first-class, schema-level concept
**Decision:** Every record distinguishes **real** (pulled from a primary source, cited to
its ArcGIS layer) from **modeled / derived / estimated** values. This is encoded in the
schema via a `confidence` enum type and a `provenance jsonb` column on tables that carry
derived fields (`property`, `risk_profile`, and the score/underwrite JSON later) — not
left to prose.

**Why:** Both hand-run dossiers mix real fields (zoning, assessed value, sale history)
with modeled ones (bed counts, rents) and only stay trustworthy because every number is
labeled. "Legal guardrails are a feature" (CLAUDE.md) applies to *data* too: the engine
must never present a modeled number as fact. This is also what keeps the scoring engine
honest when it marks a deal "low confidence" instead of fabricating comps.

**Convention:** for any derived/modeled field `foo`, record
`provenance.foo = { source, confidence, as_of }` where `confidence ∈
('real','modeled','estimated','low','unknown')`. Real source fields cite their layer
(e.g. `"layer 20"`, `"layer 1"`, `"layer 3"`).

---

*Supersedes nothing. Future ADRs live alongside this file as `000X-*.md`.*
