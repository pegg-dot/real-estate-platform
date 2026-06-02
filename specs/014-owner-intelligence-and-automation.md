# Spec 014 — Owner Intelligence + Full-Pipeline Automation

**Status:** PLAN (free portfolio-resolution win built; vendor adapters scaffolded) · **Depends on:** 009 (sourcing), 012 (distress)

This is the layer that turns LOT from "a scored map" into "a machine that knows the human behind
every door and works them, end-to-end." It's the highest-leverage thing left. Here's the real
plan — what's buildable now for free, what needs bought data, what's a legal trap, and how the
whole pipeline automates.

---

## The vision (one paragraph)
For every motivated owner LOT surfaces, build a **dossier on the person, not just the parcel**: who
they are, what they own, their *situation* (death/probate, divorce, distress, relocation, tired
landlord), how to reach them, and — crucially — **how to approach them and what to say**. Then
**automate the whole funnel**: find → enrich → understand → personalize → reach out (compliantly) →
follow up → track → close. Nate opens LOT to "here are 10 people, here's their story, here's the
letter — approve."

## The honest reality (buy commodity, build the edge — golden rule #2)
1. **The data is BOUGHT, not scraped.** Owner contact + demographics + life-events live in
   skip-trace/enrichment databases (BatchData, Endato/PeopleData, REISkip, TLOxp, IDI/LexisNexis,
   Pipl, Spokeo). They aggregate public records + credit headers + phone/utility data legally. We
   build a **pluggable adapter** per vendor; Nate plugs in ONE account and it lights up. We do NOT
   rebuild this — that's the commodity.
2. **Direct social-media scraping is a trap — we won't do it.** LinkedIn/Facebook/Instagram
   actively block servers, prohibit scraping in their ToS, and litigate (LinkedIn v. scrapers). It's
   brittle and legally risky. Instead: (a) enrichment vendors already fold in web/social profiles
   legally; (b) for the human touch, LOT gives **research deep-links** (county clerk, circuit court,
   GIS, obituary search) so Nate can look in 2 clicks — no scraping, no risk.
3. **Compliance is the MOAT, not a chore.** Skip-trace data carries real rules — FCRA (locating an
   owner to make an offer is OK; using it for tenant/credit/employment *eligibility* is NOT — never
   a "consumer report"), DPPA (DMV data), GLBA (financial), TCPA/DNC (phones — already gated), and
   the **dignity rule** (estate/probate/grief → cooling-off + manual review, already enforced). LOT
   doing this *within the lines* is exactly what fearful/sloppy competitors won't — and it's
   defensible to the family trust.

---

## Built NOW, free, no vendor (the proof it's real)
**Owner portfolio / entity resolution** — we already hold every parcel + its owner, so for free we
can answer *"this owner owns 7 parcels worth $2.4M, oldest held 28 years, 3 with neglect flags"* →
a **portfolio seller**, the highest-value lead type, invisible to single-parcel tools. Built:
`lib/enrich/portfolio.ts` + `/api/owner` + surfaced in the deal panel ("Owner owns N other
parcels"). This alone is a genuine intelligence edge at $0.

Also free now (no scraping): owner-level aggregates (total assessed/equity, oldest tenure, distress
count), and **research deep-links** per owner (Charlottesville GIS, Circuit Court records,
Legacy.com obituary search by name) for a human to confirm the backstory.

## Built as a SEAM (lights up when Nate adds a key)
- `owner_intel` table (migration 0012): vendor-agnostic enriched fields per owner — `{owner_id,
  category, detail jsonb, source, confidence, observed_at}` (mirrors distress_signal). Skip-trace
  phones/emails, probate/death, divorce, bankruptcy/liens, employment all land here.
- `lib/enrich/adapters.ts`: the adapter interface (`enrichOwner(owner) -> OwnerIntel[]`) + stubs for
  **skip-trace** (BatchData/Endato), **probate/death**, **court records**. Each gated on its env key.

## The data model — an owner dossier
| Category | Fields | Source | Status |
|---|---|---|---|
| Identity | name, age, entity type | county + skip-trace | have name/entity; age = vendor |
| Portfolio | all parcels, total value/equity, oldest tenure, distress count | OUR data | ✅ free (built) |
| Contact | mailing addr, phones, emails, social handles | skip-trace vendor | mailing have; rest = vendor |
| Situation | probate/death, divorce, bankruptcy, liens, foreclosure, relocation, job change | probate/court vendors + feeds | seam |
| Distress | code violations, tax delinquency, vacancy | free + vendor | code-violations ✅ (012) |
| Approach | the read on their situation + the script | LOT (LLM + Playbook) | ✅ logic exists |

## Full-pipeline automation (the weekly machine)
Extend the refresh loop into an end-to-end funnel, every step gated by compliance:
```
1 SENSE     ingest parcels + distress (have)
2 SCORE     re-rank to the active thesis (have)
3 SOURCE    rank motivated, by-room-legal owners (have)
4 ENRICH    skip-trace + situation on the top-N leads (NEW: adapters; key-gated)        ← biggest add
5 READ      infer the backstory + the approach from the situation (NEW: LLM + Playbook)
6 PERSONALIZE  draft the reverse-pro-forma letter from THEIR situation (have; enrich it)
7 REACH     mail (compliant, have); SMS/call deferred behind DNC+consent (have gate)
8 FOLLOW-UP a cadence: 2nd/3rd touch on no-reply; stop on opt-out (NEW: cadence engine)
9 CAPTURE   reply → deal at 'watch' (have) → pipeline → close → LEARN (have)
```
Scheduling: the GitHub Actions weekly cron already exists; enrichment runs on the top-N to control
vendor cost (you pay per lookup — so we enrich the *shortlist*, not all 13k).

## Decisions for Nate (this is what unlocks it)
1. **Skip-trace vendor** — which account to open (BatchData and Endato/PeopleData have clean APIs;
   PropStream bundles data). I build the adapter; you add the key.
2. **Life-event feeds** — a probate/foreclosure vendor (or start with the free county-records links).
3. **Legal posture** — confirm enrichment is for *locating owners to make offers only* (not tenant
   screening), so we stay out of FCRA "consumer report" territory. (We'll stamp every dossier
   "informational, not a consumer report; not for eligibility decisions.")
4. **Telephony** — still mail-only until you green-light a DNC/consent-gated phone channel.

## Why this is the moat (not the software)
Per STRATEGY-REFRAMES: the code is copyable; the **private, compounding asset** is the enriched,
compliant owner-intelligence + Nate's decision history. A competitor can buy the same skip-trace
feed — they can't buy LOT's by-room-legality gate fused into sourcing, its portfolio-seller
resolution, its situation-aware AI outreach, or Nate's revealed-preference loop. Usage IS the
flywheel.
