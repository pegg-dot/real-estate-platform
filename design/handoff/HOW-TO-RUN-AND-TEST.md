# HOW TO RUN & TEST — for the operator (you)

You don't have to reconcile names, rename files, or wire anything by hand. Claude Code figures
that out. Here's the whole flow.

## What to paste into Claude Code (literally)
Open the `real-estate-platform` repo in Claude Code, make this design-system project available, and
paste this:

> Read `handoff/00-START-HERE.md` and everything it links, plus `CLAUDE.md` and
> `docs/FRONTEND-MAP.md`. Then do **Phase 1** from `handoff/05-BUILD-TICKETS.md` (the restyle pass).
> The route/file names in `handoff/03-API-CONTRACTS.md` are my best guess from the outside —
> **discover the real names yourself** by reading `web/app/` and `web/app/api/`, and reconcile any
> differences automatically. Don't ask me to rename things. Only stop and ask me when something
> touches money, legality, sending email, or deleting data. Leave a `// LOT-DECISION:` comment
> wherever you make a call. When Phase 1 is done, run the app, show me before/after screenshots of
> one page, and wait for my OK before Phase 2.

That's it. (The Phase-1 prompt in `handoff/PHASE-1-RESTYLE-PROMPT.md` is the longer version of the
same thing.)

## How to test ONE page (the fast loop)
You don't need to build the whole thing to check it. Ask Claude Code to do **one page first** — say
the **Brief** page — and verify it:

1. Tell Claude Code: *"Just restyle the Brief page (`/brief`) first. Run the dev server and show me
   a screenshot next to `ui_kits/terminal/BriefScreen.jsx`."*
2. Claude Code runs `npm run dev`, opens `http://localhost:3000/brief`, screenshots it, and compares
   to the kit screen. It can self-check: same colors/tokens, same layout, no console errors,
   `npm test` + `npm run typecheck` green.
3. You eyeball the screenshot. If it matches the kit, say "ship it, do the next page." If not, say
   what's off in plain words ("the cards are too bright", "wrong font on the title") — it fixes and
   re-screenshots.
4. Repeat page by page. Each page is a tiny PR you can approve independently.

> To look yourself: `npm run dev` in the repo, then open `http://localhost:3000/brief` in a browser.
> Compare to the matching file in `ui_kits/terminal/`.

## "For things you don't know" — Claude Code figures it out, not you
The handoff tells Claude Code to **self-reconcile** anything I couldn't know from the outside:
- **Route or file names don't match my guess?** It greps `web/app/` + `web/app/api/`, finds the
  real one, and adapts — no renaming chore for you.
- **A field name differs?** It reads `docs/data-model.md` + the live route and maps it in one place.
- **A visual detail isn't specified?** It derives from the design tokens + the nearest kit component.
- **It made an assumption?** It leaves a `// LOT-DECISION:` comment so you can skim them later.

It only interrupts you for the things that actually need a human: spending money, legal language,
sending real outreach, or destructive actions. Everything else, it resolves and notes.

## The rhythm
Phase 1 (restyle, page by page) → you approve → Phase 2 (real deal dossier) → … → Phase 6 (GAP
pages). Small PRs, you approve each. You never have to touch the engine or rename files.
