# LOT — Integration Spec (prototype → production)

How the **Terminal UI kit's** mocked surfaces map to real APIs. The kit fakes results so the UX
is reviewable; this is the contract to make them real. Routes follow the existing Next.js app
(`real-estate-platform/web/app/api/*`) and the TypeScript engine (`/lib/*`). Everything stays
**informational, not legal/financial advice** — keep the modeled-vs-real labels and the
attorney-trigger on any creative-finance structure.

---

## 0. Auth & keys
| Capability | Mechanism | Where it lives |
|---|---|---|
| **Google Photorealistic 3D** | Google Maps API key (Map Tiles API + Maps JS `v=alpha`, `maps3d` lib) | client-side; restrict by HTTP referrer. Prototype stores it in `localStorage.lot_gkey`. In prod, inject at build or proxy. |
| **Gmail send** | Google OAuth 2.0, scope `https://www.googleapis.com/auth/gmail.compose` (or `gmail.send`) | server-side OAuth; store refresh token per operator. |
| **Claude (console NL)** | Anthropic API key | server-side only — proxy through `/api/ask`; never ship the key to the client. |
| **County / market data** | existing ingestion (`/ingestion`) → Supabase | already built. |

---

## 1. Real 3D map — Google Photorealistic 3D Tiles
**Prototype:** `MapScreen.jsx` injects `maps/api/js?key=…&v=alpha`, creates a `Map3DElement`
centered on Charlottesville, and drops a `Marker3DElement` (label = score) per parcel.
**Production:** identical, but the key comes from a referrer-restricted env var, and parcel
markers are fed from `/api/parcels` (below) instead of `LOT_DATA`. Camera: `center
{lat,lng,altitude}`, `range`, `tilt`, `heading`. Click → `gmp-click` → open the deal drawer for
that APN.

```
GET /api/parcels?bbox=...&minScore=&byRoomLegalOnly=  →  GeoJSON
  feature.properties: { apn, address, lat, lng, score, tier, coc, beds, zone, byRoomLegal, distress[] }
```

---

## 2. Console tool calls (the "Claude Code" surface)
The console runs a **tool-use loop**. Client sends the transcript to a server route; the server
runs Claude with these tool definitions, executes the tool against `/lib`, and streams back a
narration + a structured `tool_result` the client renders as a card (`AgentConsole.jsx`).

```
POST /api/console
  body: { messages: [{role, content}], focusApn?: string }
  resp: { text: string, tool?: { name, input, result } }
```

### 2a. `underwrite` — per-house & per-unit
Prototype computes locally; production calls the scoring/exit engine.
```
name: "underwrite"
input:  { apn: string, mode: "by_room" | "whole_house" | "both" }
calls:  lib/scoring/scoreRow + lib/exit (exit-strategy menu), lib/rent (HUD FMR floor, comps)
result: {
  apn, beds, units,
  byRoom:  { grossYr, noi, coc, rentBasis: "modeled"|"hud_fmr"|"real_comps" },
  whole:   { grossYr, noi, coc, rentBasis },
  recommended: "by_room"|"whole_house",
  sensitivity: { cocLow, cocHigh }, confidence: number, byRoomLegal: boolean
}
```

### 2b. `draft_email` — compliant owner outreach → **Gmail**
Prototype renders the draft and opens **Gmail compose** (`mail.google.com/mail/?view=cm&fs=1&su=&body=`)
so the operator sends from their own account. Production uses the Gmail API server-side.
```
name: "draft_email"
input:  { apn: string, tone?: "neutral"|"gentle_estate" }
calls:  lib/outreach (compliant template + suppression rules) → returns { to?, subject, body, complianceReceipt }
send:   POST /api/outreach/send { apn, to, subject, body }
          → Gmail API users.messages.send  (OAuth, gmail.send)
          → writes outreach_event { apn, channel:"email", sentAt, receipt }   // audit trail
guardrails: never auto-send to estate/trust owners — route to manual-review lane;
            honor do-not-contact + ≤1 follow-up; log every touch.
```

### 2c. `automate` — recurring flows
Prototype shows trigger → steps → Enable toggle. Production registers the job on **the existing
weekly refresh loop** — `scripts/refresh-market.ts` (which already drives `lib/scout` for
"what changed" and `lib/radar` for zoning). **This is the locked default: no new scheduler.**
A cron wrapper (e.g. GitHub Actions `schedule:` or a Supabase cron) simply invokes
`refresh-market.ts` on a cadence; automations are rows it reads each run.
```
name: "create_automation"
input:  { name, trigger: {type:"schedule"|"price_drop"|"legality_flip"|"new_distress", apn?, cron?}, steps: string[] }
store:  table `automation` { id, name, trigger_json, steps_json, enabled }
runner: scripts/refresh-market.ts → after ingest+score, evaluate each enabled automation's
        trigger against this run's change_event / regulatory_event rows → fire steps
        (re-underwrite, add-to-pipeline, draft-mailer) → surface in the Brief + change-feed rail.
result: { id, enabled:false }
POST /api/automation/toggle { id, enabled }   // arm/pause
```

### 2d. `compare`
```
name: "compare"  input: { apns: string[] }  calls: deal_genome view  result: rows[]
```

---

## 3. Map / Brief / Pipeline / Leads (already-specced routes)
These mirror `docs/FRONTEND-MAP.md`:
- `GET /api/brief` → action queues (REGULATORY_KILL · ACT_ON_DEAL · ZONE_OPENED · MAIL · VERIFY_ZONING)
- `GET /api/dossier?apn=` → the deal drawer payload (score, components, financing[], distress[], snapshot)
- `POST /api/actions { action:"track-deal", apn }` → pipeline insert
- `GET /api/leads` → ranked motivated owners (motivation = the "bunny" inference)
- `GET /api/changes` / `GET /api/radar` → the time-rail + Brief

---

## 4. What's still simulated in the prototype (do not ship as-is)
- **Underwrite math** is a simplified local model ($850/bed, fixed opex %). Replace with `lib/scoring`.
- **Gmail** opens a compose window; it does **not** send or log. Wire `/api/outreach/send` + `outreach_event`.
- **Automations** toggle UI only — no scheduler is attached.
- **Console narration** is live Claude (Haiku) but tool *results* are local; move tool execution server-side.
- **Real 3D** needs the operator's Google key; markers come from `LOT_DATA`, not the live DB.

> Sequence to productionize: (1) `/api/parcels` → real 3D markers, (2) `/api/console` tool-loop with
> `underwrite`, (3) Gmail OAuth + `/api/outreach/send`, (4) automation registration on the weekly loop.
