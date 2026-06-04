# 03 · API Contracts — every route the UI calls

The UI must talk to these routes only (never to `/lib` directly from the client). Existing routes
live under `web/app/api/*`; new ones are marked **NEW**. Confirm exact field names against the live
route, then treat these as the contract. Full console/Gmail/3D detail is in the design-system
root **`INTEGRATION-SPEC.md`** — this file covers the standard pages too.

## Convention
- All responses JSON. Errors: `{ "error": string }` with a 4xx/5xx. The UI shows a calm inline state, never a raw stack.
- Money as numbers (dollars); the UI formats. Percentages as decimals (`0.058`) unless noted.
- Every mutation goes through `/api/actions` or a dedicated POST — never a client-side write.

## Read routes
| Route | Returns | Backed by |
|---|---|---|
| `GET /api/parcels?bbox=&minScore=&byRoomLegalOnly=&absenteeOnly=&distressOnly=&maxPrice=&minBeds=` | GeoJSON FeatureCollection (see `02`) | `deal_genome` view |
| `POST /api/filter { q }` | structured filter object (NL → query) | `lib/thesis` LLM |
| `GET /api/dossier?apn=` | full dossier (see `02`) | **upgrade to** `lib/dossier/renderDossier` |
| `GET /api/brief` | `{rows[], summary}` | `lib/brief` |
| `GET /api/leads` | ranked leads[] | `lib/sourcing` + `distress_signal` |
| `GET /api/owner?apn=` | owner portfolio + situation + research links | `lib/sourcing` + owner tables |
| `GET /api/changes` | what-changed feed[] | `lib/scout` / `change_event` |
| `GET /api/radar` | zoning opportunity/risk cards[] | `lib/radar` / `regulatory_event` |
| `GET /api/learn` | divergence report + proposed weight diff | `lib/learn` |
| `GET /api/rents?apn=` | rent comps[] for a parcel | `lib/rent` / `rent_comp` |
| `GET /api/theses` | thesis versions[] | `thesis` table |
| `GET /api/config` | market + thesis summary | `config/` |

## Mutations
| Route | Body | Effect |
|---|---|---|
| `POST /api/actions` | `{action, apn?|dealId?|leadId?}` | the single writer: `track-deal`, `advance`, `pass`, `draft-mailer`, `add-rent-comp`, `enrich-owner`, `generate-leads`, `propose-retune` |
| `POST /api/theses` | `{prose}` / `{activate:id}` / `{compare:[a,b]}` | intake + activate/compare |
| `POST /api/rescore` | `{thesisId}` | re-rank the map |
| `POST /api/outreach/send` **NEW** | `{apn,to,subject,body}` | Gmail API send → write `outreach_event` |
| `POST /api/console` **NEW** | `{messages[], focusApn?}` | the Console tool-loop (see INTEGRATION-SPEC §2) |
| `POST /api/automation/toggle` **NEW** | `{id, enabled}` | arm/pause an automation row |

## The Console tool-loop (`POST /api/console`) — summary
Server runs Claude with tool definitions, executes each against `/lib`, returns
`{ text, tool?: {name, input, result} }`. Tools: **`underwrite`** (`{apn, mode:"by_room"|"whole_house"|"both"}` → `lib/scoring`+`lib/rent`+exit menu), **`draft_email`** (`{apn,tone}` → `lib/outreach`, then `/api/outreach/send`), **`create_automation`** (`{name,trigger,steps}` → `automation` table, run by `scripts/refresh-market.ts`), **`compare`** (`{apns[]}` → `deal_genome`). Never auto-send to estate/trust owners; honor do-not-contact + ≤1 follow-up; log every touch. Full schemas: `INTEGRATION-SPEC.md`.

## Auth & secrets (see INTEGRATION-SPEC §0)
- Google Maps key: referrer-restricted, client-side (public by nature). The Settings vault UI edits it; production injects it.
- Anthropic key, Gmail OAuth secret + refresh tokens, RentCast/skip-trace keys: **server-side only**, in the host secret manager — never sent to the browser. Gate Settings edits behind the operator's auth session.

## Definition of "wired"
A screen is done when it reads a real route (no mock `LOT_DATA`), renders the design-system
components, keeps modeled/real labels + guardrails, and the matching `docs/FRONTEND-MAP.md` row is ✅.
