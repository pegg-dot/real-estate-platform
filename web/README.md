# LOT web — functional UI preview (spec 005)

A Next.js + Mapbox app over the **live** Supabase data the engine produces. Deliberately
**functional-first** (plain styling) so the data + flows are visible; the visual design pass
happens via Claude design on top of this.

## Run it
The easy way is the repo-root `docker compose up` (see the root README). For hands-on development:
```bash
cd web
npm ci                            # first time only
npm run dev                       # http://localhost:3000  (use -p 3939 if 3000 is busy)
```
`next.config.mjs` loads the repo-root `.env` automatically, so `SUPABASE_DB_URL` (and optionally
`NEXT_PUBLIC_MAPBOX_TOKEN` / `ANTHROPIC_API_KEY`) live in one place for the engine CLIs and the app.

## What's here
- **/** — the **deal map**: every scored parcel (≈12.3k) plotted, colored by thesis score
  (red→amber→green), an outline ring when it trips a constraint. Click a dot → the **deal
  panel** (score, headline CoC + range, confidence, snapshot, score breakdown, financing rec
  with the legal guardrail).
- **/leads** — top motivated, by-room-legal owners (run `npm run leads -- --generate` to populate).
- **/deals** — the deal pipeline board (watch → … → owned/exited/passed).

## Architecture
Isolated from the engine repo (its own `package.json`) to avoid bundler/tsconfig conflicts with
the engine's ESM `.js`-extension imports. It reads the **same live data** via direct SQL on the
`deal_genome` view + `lead`/`deal` tables (`app/lib/db.ts`, `app/api/*`), so it's always in sync
with whatever the engine last scored — no duplicated logic, no separate data store.

## Next (the design pass)
Generate the visual design (Claude design / AIDesigner), then restyle these pages — the data
wiring, routes, and component structure stay; only the presentation changes.
