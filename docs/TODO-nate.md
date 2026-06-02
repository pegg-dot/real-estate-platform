# TODO — things only Nate can do

> The agent can't click dashboards, sign up for accounts, rotate secrets, or hold a credit
> card. This is the running list of those. Checked = done. Keep it short; prune when done.

## 📋 Your review queue
- [ ] **Review + merge the `feat/lot-strategy-and-property-intelligence` branch** — specs 019
      (exit-strategy optimizer + seller engine), 020 (highest-and-best-use), 016 (expert-mind
      learning layer), 015 (acquire-coach + lead stacking). ~30 commits, all code-reviewed +
      live-verified, nothing merged to `main` yet. Open a PR from the branch on GitHub and merge
      when you're happy. Then the **visual design pass** (Claude design) can polish the new UI:
      the deal panel's exit-menu + HBU, the leads stack/bunny/channel + funnel line, the coach
      playbook, and a development-upside map layer (data ready via `/api/parcels?developOnly=true`).
- [ ] **Two calibration dials to eyeball** (working, just judgment calls): exit-strategy mix
      (by-room 56% / MTR 31% / Section 8 9% — tune `exit_strategy` in the thesis if you disagree);
      and HBU develop returns are annualized *screening proxies*, not IRRs (an underwriter-grade
      model is a future upgrade).

## 🔐 Security — do soon
- [ ] **Rotate the Supabase DB password** — it was shared in chat (Supabase → Settings →
      Database → Reset password), then update `SUPABASE_DB_URL` in `.env`.
- [ ] **Rotate the Anthropic API key** — also shared in chat (console.anthropic.com →
      Settings → API Keys → roll the key), then update `ANTHROPIC_API_KEY` in `.env`.

## ✅ Unlocks features already built
- [x] **Anthropic API key** added to `.env` (valid — authenticates).
- [ ] **Add Anthropic billing/credits** — the key works but the account has **$0 credits**. This
      now gates SEVERAL fully-built features (they degrade cleanly until then):
      Fix: console.anthropic.com → Plans & Billing → add a payment method / buy credits. Unlocks:
      • conversational thesis intake (`--from "<prose>"`) + the NL map filter + Ask LOT
      • **expert-mind transcript distillation** (`npm run ingest-source -- <transcript.txt>`) —
        auto-extracts cited rules/exemplars/params; the offline `.json` path works without credits
      • **negotiation roleplay** (the seller-persona drill + rubric scoring; spec 015) —
        `lib/coach/roleplayLlm.ts` is built and wired, just needs the model to run.
- [ ] **(optional) HUD FMR API token** — only needed to *refresh* real rents annually or add
      markets. The FY2026 Charlottesville numbers are already seeded from public data, so rent
      reality works without it. Get one free at huduser.gov → Create New Token if/when you want
      auto-refresh.
- [ ] **Turn on the weekly automation** (the Scout/Radar loop on a schedule):
      GitHub repo → Settings → Secrets and variables → Actions → add `SUPABASE_DB_URL`
      (and optionally `ANTHROPIC_API_KEY`). Then Actions tab → enable workflows. The
      `weekly-refresh` workflow runs Mondays + has a manual "Run workflow" button.

## 📊 Data sources — decide / sign up (accuracy upgrades, not blockers)
- [ ] **RentCast key** (real rents) — free key at api.rentcast.io → `RENTCAST_API_KEY` in `.env`,
      then `npm run rents -- --rentcast "<address>"`. Or enter manual comps now:
      `npm run rents -- --add "<addr>" --lat .. --lng .. --beds N --rent M [--byroom]` ($0, immediate).
- [ ] **(optional) scraping service** (Bright Data / ScraperAPI) — Craigslist/Zillow/Apartments
      block direct scraping; a proxy/headless service would unlock them (the `rent_comp` table +
      parser drop in). Your call on cost + legal posture.
- [ ] **(optional) paid distress vendor** (PropStream/BatchData) — foreclosure / lis-pendens /
      probate coverage; inserts into the same `distress_signal` table (no code change needed).
- [ ] **Owner enrichment / skip-trace key** (spec 014) — the whole owner-intelligence funnel (phones,
      emails, contact) lights up the moment you add ONE: `BATCHDATA_API_KEY=...` (BatchData) **or**
      `ENDATO_NAME=... ENDATO_KEY=...` (Endato) in `.env`. The free layer (portfolio resolution, the
      situation-read, research links) already works without any key. Run: `npm run enrich -- --leads`.

- [ ] **Rent comps** — pick the path (see "How rent data works" below). Free baseline
      (HUD FMR + Census + a light UVA-listings scrape) costs $0; paid (RentCast free tier →
      paid, or Rentometer) is address-level. Until then, rents stay **modeled** (flagged).
- [ ] **Distress feeds** (foreclosure / lien / probate) — powers the Scout's "new distress"
      signal. Needs a county-records source or a vendor (e.g., PropStream/BatchData). Today
      the Scout diffs only what we hold (tenure / equity / absentee / sale).
- [ ] **Miami-Dade expansion** (when ready): county parcel/assessment endpoints, FEMA flood,
      insurance quotes, and condo SIRS data (Miami risk is first-class — golden rule #3).

## 🔭 Future (Phase 4+, not needed yet)
- [ ] Direct-mail vendor for outreach (when the Sourcing agent ships).
- [x] Mapbox token (already in `.env`) — for the future map UI (spec 005).

---

## How rent data works (so you can decide the rent path)

**How the vendors get it:** RentCast / Rentometer / PropStream don't own rents — they
**aggregate active rental listings** (Zillow, Apartments.com, Realtor.com, Craigslist,
Facebook Marketplace, property-manager feeds), mix in **MLS** (licensed, agent-only,
expensive) and **public records**, then run an AVM (model) to spit out an address-level
estimate. You're paying for the aggregation + model, not secret data.

**Can you get it free? Partly — here's the honest stack:**

1. **HUD Fair Market Rents (FMR)** — FREE official API, rent **by bedroom count** (0–4br),
   by metro/county/ZIP. It's the 40th-percentile rent (Section-8 basis), so it slightly
   *understates* market — but it's real, defensible, by-bedroom, and free. A big upgrade
   over our current flat model for the **whole-house** baseline. (SAFMR = ZIP-level variant.)
2. **Census ACS** (median gross rent by tract) — free, but broad and dated. Sanity-check only.
3. **Scrape UVA-area student listings** (Craigslist, Facebook Marketplace, UVA off-campus
   board, Apartments.com) for the **by-the-room premium near campus** — this is the number
   that actually drives our model, and it's the one nobody packages well. This is gray-area
   (ToS), brittle, and rate-limited; Zillow/Apartments block aggressively, Craigslist + the
   university board are the most tolerant. At one-user, low-volume, a light respectful scrape
   is feasible and is arguably the *edge* (the by-bed student premium is the moat).

**Recommendation:** free **HUD FMR** for the whole-house baseline (replaces the flat model
with real, free numbers) + a small **UVA-listings scrape** for the by-bed premium, and keep
**RentCast's free tier (50/mo)** to spot-check a specific deal before you make an offer.
That's $0 to start and more honest than a generic AVM, because the by-the-room number is
local and we control it. When volume justifies it, swap in a paid vendor — it's a one-file
change (`config/market-assumptions/<market>.json` + a `lib/rent/` source).
