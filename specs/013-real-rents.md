# Spec 013 — Real rent comps (Phase 4+)

**Status:** framework + RentCast + manual BUILT 2026-06-02 · **Depends on:** 003 (scoring), 007 (HUD floor)

## Purpose
Replace the modeled `$/bed` with REAL, distance-weighted rent comps where they exist — flipping
rent provenance to real and lifting confidence past the modeled ceiling. The by-the-room
near-campus premium (which HUD FMR can't see) lands here as real per-ROOM comps.

## Honest feasibility (the scrape question)
Direct scraping of Craigslist / Zillow / Apartments.com is **blocked from a server** (Craigslist
returns `403 "blocked"`; the rest require JS + anti-bot). A reliable scrape needs a headless
browser + rotating proxies (a paid scraping service). So the working sources are:
- **RentCast** (api.rentcast.io) — legal API, real comps + AVM by address, free tier ~50/mo.
- **Manual comps** — a rent Nate knows, entered by hand: $0, immediate, and the only easy source
  of real per-ROOM student rents.
- **scrape:<site>** — drops into the same table if a scraping service is wired later.

## What shipped
- `supabase/migrations/0011_rent_comp.sql` — multi-source `rent_comp` (geo, beds, rent, per-bed,
  `is_by_room`, source; idempotent).
- `lib/rent/comps.ts` (pure, 5 tests) — `estimateRealRent`: distance-weighted per-bed rent from
  nearby comps, `preferByRoom` for the student signal, null when nothing's close (→ modeled).
- `lib/rent/rentcast.ts` (pure parse, 4 tests) — RentCast AVM + comps; fetch gated on `RENTCAST_API_KEY`.
- `lib/db/rentComps.ts` — `loadRentComps`, `addRentComp` (manual/any source).
- **Scoring wiring**: `scoreRow` overrides the modeled `$/bed` with `estimateRealRent` when comps
  are near the parcel; flips `rentSource` to `real-comps` and lifts confidence past 0.90.
  `scoreMarket` + the dossier both load comps. The dossier header reads "REAL rent comps".
- `scripts/rents.ts` + `npm run rents` (--add / --rentcast / --list).

## Acceptance (verified live, then DB cleaned)
- A real $1050/bed by-room comp near 1105 Grove flipped its dossier to "REAL rent comps":
  by-room gross $825→$1050/bed (→$63k/yr), confidence 0.90→**0.94**, score 77→79. ✅
- No comps near a parcel → falls back to modeled (provenance honest). ✅

## Operator action (docs/TODO-nate.md)
- (optional) free **RentCast** key → `RENTCAST_API_KEY` in `.env` for address-level real comps.
- enter a few **manual** per-room rents you know (`npm run rents -- --add …`) — immediate, $0.
- (optional) a scraping service (Bright Data/ScraperAPI) if you want Craigslist/Zillow at scale.
