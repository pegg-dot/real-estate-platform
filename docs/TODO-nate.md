# TODO — things only Nate can do

> The agent can't click dashboards, sign up for accounts, rotate secrets, or hold a credit
> card. This is the running list of those. Checked = done. Keep it short; prune when done.

## 📋 Your review queue
- [ ] **Review + merge the `feat/lot-strategy-and-property-intelligence` branch** — specs 015
      (acquire-coach + lead stacking), 016 (expert-mind learning), 017 (path-of-progress /
      land-banking), 018 (portfolio advisor), 019 (exit-strategy + seller engine), 020
      (highest-and-best-use). ~38 commits, all code-reviewed + live-verified, nothing merged to
      `main` yet. Open a PR from the branch on GitHub and merge when you're happy. ✅ The
      **visual design pass is DONE** — the whole app is restyled to the LOT dark "operational
      terminal" design system (Phase 1 map + deal drawer; Phase 2 every other screen). Deal drawer
      has score-breakdown bars + REAL/MODELED provenance badges; the map rail has the lens selector,
      development-upside toggle, "what changed" feed, and Top matches. Tokens in `web/app/tokens.css`.
      (Still open as future polish: a growth-corridor heat map layer via `/api/growth`, and wiring
      the 3D map view — both noted but not blocking.)
      New CLIs to try: `npm run growth` (land-banking buy-ahead shortlist), `npm run portfolio`
      (best-next-buy), `npm run coach` (call playbook), `npm run ingest-source` (distill a source),
      `npm run interrogate -- <apn>` (Pace structures / Grant challenges / synthesis — spec 023; also
      the "🔎 Interrogate this deal" button on the deal panel).
      ✨ NEW — the **unified Chat** (`/chat`, specs 024+025): one ChatGPT-style chat with a **fleet of
      9 agents** + saved history + a context-feed ("💬 Add to chat" on a deal panel / leads row attaches
      parcels/leads). Agents: **Auto** (the neutral do-anything default) · Explainer · Operator ·
      Deal Interrogator · Coach · **Outreach Writer** (drafts CAN-SPAM owner emails → review on
      `/outreach`) · **Scheduler** (proposes calls/follow-ups/visits → `/schedule`) · **Analyst**
      (read-only SQL Q&A) · **Negotiation Simulator** (practice the call, get scored). Everything is
      propose/draft — nothing sends or spends on its own. Works at **$0 credits**: Interrogator, Coach,
      Outreach drafts, Scheduler, and Auto's interrogate/coach tools. Needs credits: Auto/Operator/
      Explainer/Analyst/Simulator's model replies.
      🔌 **Connectors you can wire later** (one-time, your accounts) to make execution real: a Gmail/
      Resend transport (actually send the drafted emails) and Google Calendar (sync the scheduled
      events). Until then the drafts/events persist in-app for review.
- [x] **The exit mix now ADAPTS to your decisions.** `lib/learn/retune.ts` learns
      `management_appetite` from the operating intensity your *advances* favor vs your *passes*
      (proposeAppetiteRetune — same governance as the weight learner: ≥40 decisions, 1/√n shrink,
      per-cycle cap, clamp 0–1; proposes only, you approve via the Brief → "Propose thesis retune").
      So the by-room/MTR/STR/Section-8 mix shifts toward what you actually pursue — learned, not
      hardcoded. (Surfaces "below floor" until you've logged ~40 advance/pass decisions.)
- [ ] **Remaining adaptive upgrade (needs outcome data): the OUTCOME loop.** The rent multipliers
      (MTR 1.4× / STR 2.5×) and the HBU develop returns (annualized screening *proxies*, not IRRs)
      are still modeled priors. To make them learned: when a deal CLOSES, record the realized
      rent/return and feed it back to calibrate the multipliers + an underwriter-grade HBU model.
      Requires closed-deal data, so it's post-first-deals — see Adaptive scoring under Future.

## 🔌 Multi-user + real connectors (spec 026) — YOUR setup (code is inert until done)
> Goal: you + your brother each log in, connect your own Gmail + Calendar, and the agents' drafts/
> events actually send/sync. Foundation (the `app_user` + `connector` tables, the auth scaffold) is
> built and **non-breaking** — the app still runs single-user locally until you do the steps below.
> These can only be done by you (accounts, OAuth apps, billing); none can be done by the agent.
- [ ] **Supabase Auth** — enable it + the **Google** sign-in provider (needs the Google OAuth client below).
- [ ] **Google Cloud project** — create an **OAuth consent screen** + **OAuth client (Web)**; enable
      the **Gmail API** + **Google Calendar API**; add the send/draft + calendar scopes; add you +
      your brother as **test users**. Then put `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in env.
- [ ] **Hosting** — a **Railway** (or Render/Fly) account; deploy the repo; set env vars
      (`SUPABASE_DB_URL`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `GOOGLE_CLIENT_ID/SECRET`,
      `CONNECTOR_SECRET` (any long random string), `AUTH_ALLOWLIST` = your two emails, `AUTH_ENABLED=true`).
- [ ] **Enrichment vendor key** — Clay / BatchData / Endato for skip-trace (feeds the Outreach Writer real recipients).
- [ ] Once the above exist, tell me and I'll finish **Phase 2 (auth wiring)** + **Phase 3 (connectors)**
      and verify the OAuth round-trips end-to-end (I can't test those without your Google app).

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
      • **the Agent console** (spec 022, the `/agent` chat + `npm run agent`) — a Claude-Code-style
        operator that reads anything in the DB, runs the analyses, and PROPOSES actions you approve.
        Reads + proposals work now; the conversational loop needs credits.
- [ ] **(hardening, optional) give the Agent a read-only Postgres role** — `query_db` is already
      SELECT-only in code (rejects writes incl. `SELECT INTO`), but a dedicated read-only DB role for
      the agent connection is belt-and-suspenders. Create one in Supabase and point the agent's DSN at
      it if/when you expose the agent beyond yourself.
- [ ] **(to send agent/owner emails) add an email transport** — the agent DRAFTS emails + the compliance
      requirements; sending needs an email API (e.g. Resend/SMTP, or the Gmail API). Owner emails must
      carry a physical address + unsubscribe (CAN-SPAM) and route through the compliance gate.
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
- [ ] **Adaptive / per-person scoring** (post-v1 upgrade to multi-user, spec 026). Today the
      underlying scored-parcel dataset stays **shared** — it's the same ~13k Charlottesville parcels,
      scored once against one canonical thesis. Making it **adaptive** (each person's parcels scored
      against *their own* thesis, and the scores re-learning from *their* advance/pass decisions via
      the LEARN loop) means re-scoring all ~13k parcels per-person and per-thesis-change — a heavy
      compute + storage upgrade (per-user `property_score` rows / a scoring queue). Worth it once
      multiple users are active with diverging buy-boxes; not needed for v1.
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

---

## Audit execution (2026-06-03) — connectors, multi-user, HBU fix

- **Gmail/Calendar connectors + multi-user accounts** are BUILT and flag-gated OFF. To turn on
  (incl. your brother + your Gmails), follow **`docs/operator-setup.md`** (Google Cloud OAuth,
  env vars, deploy). ⚠️ Rotate the Google client secret first (it was shared in chat).
- **HBU IRR is now live + correct** (a Postgres numeric→string concat bug had floored develop
  returns at −99%; fixed + re-scored).
- **Pre-existing data-quality item (not launch-blocking):** ~26 parcels assessed at ~$100 (vacant
  slivers / common-area artifacts) show wild negative hold cash-on-cash (e.g. −5700%/yr) because
  fixed costs exceed near-zero modeled rent. Consider gating parcels below a price floor out of the
  scored map, or clamping the displayed hold CoC. Orthogonal to the IRR work.
