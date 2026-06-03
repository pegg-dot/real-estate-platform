# 06 · Decision Rules + Guardrails

**This is the answer to "how does it know what to do for things not covered here?"** When a detail
isn't specified by the design system, the spec, or the tickets, resolve it in this order and leave a
short `// LOT-DECISION: <rule#> <one-line why>` comment.

## The hierarchy
1. **Behavior** → follow the existing repo: the relevant `specs/NNN-*.md`, the `/lib` function signatures, and the `docs/FRONTEND-MAP.md` data contracts. Reuse engine logic; never re-implement scoring/financing/underwriting math in the UI.

> **Self-reconcile names — don't make the operator do it.** The route/file/field names in
> `handoff/03` are an outside-in best guess. If they don't match, **grep `web/app/` + `web/app/api/`
> and `docs/data-model.md`, find the real ones, and adapt automatically** (map in one place, leave a
> `// LOT-DECISION:` comment). Never ask the operator to rename or reconcile — that's your job.
2. **Visuals** → derive from `colors_and_type.css` tokens + the nearest existing component in `ui_kits/terminal/` + `kit.css`. Match density, radii, hairlines, the score ramp. Introduce **no** new colors, fonts, or shadow styles.
3. **Copy / tone** → follow the design-system README "Content Fundamentals": plain, operator-to-operator, second person, mono for data, the disclaimer, attorney triggers. Use the glossary terms correctly.
4. **Data shape** → mirror `docs/data-model.md` + the `deal_genome` view + the payloads in `handoff/02`. Never fabricate fields or values. If a value is modeled, label it modeled.
5. **Still genuinely ambiguous OR it touches money / legality / sending / deleting** → **STOP and ask the user.** Do not guess.

## Never guess on (always ask)
- Irreversible or external-effect actions: sending email/mail, writing to the DB in a new way, deleting, spending budget.
- Legal language, occupancy-legality conclusions, or anything that could present creative finance as risk-free.
- Financial assumptions (rent $, opex %, vacancy, rate) — these come from the engine/config, not invention.
- Owner contact / privacy: skip-trace and outreach are compliant, mail-first, suppression-aware, not a consumer report.

## Hard guardrails (enforced by the engine — keep them visible)
- The financing engine **refuses** to emit a creative structure without its legal guardrail + attorney trigger. Surface both; never strip them.
- Estate/trust owners → manual-review lane; never auto-mail. Honor do-not-contact + ≤1 follow-up. Log every touch to `outreach_event`.
- Due-on-sale (sub2), Dodd-Frank/SAFE (seller-finance), Garn-St.-Germain — when a structure carries these, show the guardrail text the engine returns.
- Modeled vs real: render `provenance`. Rents/insurance are modeled until their layers are wired — say so.
- Secrets never reach the browser except the referrer-restricted Google Maps key (see INTEGRATION-SPEC §0).

## Quality bar (Definition of Done, every change)
Wired to a real route + `/lib` (no mock data) · matches design tokens · `npm test` + `npm run typecheck`
green (+ `pytest` if ingestion touched) · modeled/real labels + guardrails + disclaimer intact ·
`prefers-reduced-motion` respected · the matching `docs/FRONTEND-MAP.md` row flipped to ✅ · PR small
and reviewed by the `.claude/` code-reviewer subagent.

## If the repo and this handoff conflict
The **repo's own `docs/` + `specs/`** win on *behavior/data*; the **design system** wins on
*look/voice*. If they conflict in a way that matters, stop and ask — don't silently pick one.
