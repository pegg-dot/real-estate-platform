/* LOT terminal — mock data (real Charlottesville parcels & coords; rents/scores modeled).
   Exposed as window.LOT_DATA. Informational, not legal or financial advice. */
(function () {
  const tier = (s) => (s >= 70 ? "strong" : s >= 50 ? "moderate" : "weak");

  const parcels = [
    {
      apn: "060123000", address: "1305 Grady Ave", lat: 38.039952, lng: -78.495544,
      score: 82, price: 489600, beds: "5 bd*", zone: "RN-A", byRoom: true, coc: 5.8, cocLow: 4.9, cocHigh: 6.6,
      owner: "Albemarle Holdings LLC", ownerType: "LLC", absentee: true, lastSale: "$402,000 · 2016",
      flood: "X (minimal)", conf: 0.84, model: "by-room",
      components: { "campus proximity": 95, "by-room legal": 100, "cash-on-cash": 78, "owner motivation": 64, "risk penalty": 18 },
      financing: [
        { s: "Cash / conventional", pitch: "Strong yield supports a clean DSCR loan; cash wins on speed.", guard: null, attorney: false },
        { s: "Seller finance", pitch: "Absentee LLC held 8 yrs — may carry paper to defer gains.", guard: "Dodd-Frank / SAFE Act applies if seller is not an entity exemption — paper the note with counsel.", attorney: true },
      ],
      suppressed: "Subject-To — no verified mortgage, no rate gap.",
      distress: ["absentee", "long tenure"], note: "Off-prime by-room SFR that pencils ~5.8% — the lane.",
    },
    {
      apn: "060140000", address: "1022 Grady Ave", lat: 38.038790, lng: -78.492744,
      score: 82, price: 491200, beds: "5 bd*", zone: "RN-A", byRoom: true, coc: 5.7, cocLow: 4.8, cocHigh: 6.5,
      owner: "Nguyen, Patricia", ownerType: "Individual", absentee: false, lastSale: "$311,000 · 2009",
      flood: "X (minimal)", conf: 0.81, model: "by-room",
      components: { "campus proximity": 92, "by-room legal": 100, "cash-on-cash": 77, "owner motivation": 71, "risk penalty": 20 },
      financing: [
        { s: "Seller finance", pitch: "16-yr owner-occupant, big embedded gain — a carry defers capital gains.", guard: "Owner-occupant + ≤1 unit may trigger Dodd-Frank; balloon limits apply. Counsel required.", attorney: true },
        { s: "Cash / conventional", pitch: "Fallback if seller won't carry.", guard: null, attorney: false },
      ],
      suppressed: "Subject-To — owner has near-zero balance.",
      distress: ["long tenure"], note: "Tired-landlord signal: long tenure, self-managed.",
    },
    {
      apn: "060118000", address: "1219 Gordon Ave", lat: 38.038827, lng: -78.495590,
      score: 81, price: 495300, beds: "5 bd*", zone: "RN-A", byRoom: true, coc: 5.7, cocLow: 4.9, cocHigh: 6.4,
      owner: "Gordon Ave Trust", ownerType: "Trust", absentee: true, lastSale: "$365,000 · 2013",
      flood: "X (minimal)", conf: 0.79, model: "by-room",
      components: { "campus proximity": 90, "by-room legal": 100, "cash-on-cash": 76, "owner motivation": 58, "risk penalty": 22 },
      financing: [{ s: "Cash / conventional", pitch: "Trust-held; clean conventional path.", guard: null, attorney: false }],
      suppressed: "Creative finance — trust ownership, motivation unconfirmed.",
      distress: ["absentee", "estate / trust"], note: "Estate/trust — route to manual-review lane before mailing.",
    },
    {
      apn: "060131000", address: "1101 Grady Ave", lat: 38.039179, lng: -78.493463,
      score: 81, price: 383200, beds: "4 bd*", zone: "RN-A", byRoom: true, coc: 5.6, cocLow: 4.7, cocHigh: 6.3,
      owner: "Whitfield, Marcus", ownerType: "Individual", absentee: true, lastSale: "$252,000 · 2011",
      flood: "X (minimal)", conf: 0.8, model: "by-room",
      components: { "campus proximity": 88, "by-room legal": 100, "cash-on-cash": 80, "owner motivation": 74, "risk penalty": 19 },
      financing: [{ s: "Seller finance", pitch: "Absentee, 13-yr hold — strong carry candidate.", guard: "Confirm no owner-occupied homestead; SAFE Act review.", attorney: true }],
      suppressed: "Subject-To — balance unverified.",
      distress: ["absentee", "long tenure"], note: "Lowest entry price in the shortlist; best $/door.",
    },
    {
      apn: "060109000", address: "1414 Gordon Ave", lat: 38.039430, lng: -78.497542,
      score: 79, price: 513300, beds: "5 bd*", zone: "RX-5", byRoom: true, coc: 5.5, cocLow: 4.6, cocHigh: 6.2,
      owner: "Cavalier Rentals LLC", ownerType: "LLC", absentee: true, lastSale: "$430,000 · 2019",
      flood: "X (minimal)", conf: 0.77, model: "by-room",
      components: { "campus proximity": 86, "by-room legal": 100, "cash-on-cash": 73, "owner motivation": 49, "risk penalty": 24 },
      financing: [{ s: "Cash / conventional", pitch: "Recent purchase, low motivation — cash only.", guard: null, attorney: false }],
      suppressed: "Seller finance — bought 2019, thin gain.",
      distress: ["absentee"], note: "Solid but recently traded; owner motivation is the soft spot.",
    },
    {
      apn: "060114000", address: "1307 Gordon Ave", lat: 38.039084, lng: -78.496289,
      score: 78, price: 519700, beds: "5 bd*", zone: "RN-A", byRoom: true, coc: 5.4, cocLow: 4.5, cocHigh: 6.1,
      owner: "Patel Family LP", ownerType: "LP", absentee: true, lastSale: "$388,000 · 2014",
      flood: "X (minimal)", conf: 0.78, model: "by-room",
      components: { "campus proximity": 85, "by-room legal": 100, "cash-on-cash": 71, "owner motivation": 66, "risk penalty": 23 },
      financing: [{ s: "Seller finance", pitch: "Family LP, 10-yr hold — open to a carry to spread gains.", guard: "Entity seller — likely Dodd-Frank exempt, but confirm with counsel.", attorney: true }],
      suppressed: "Subject-To — no rate gap.",
      distress: ["absentee", "long tenure"], note: "Portfolio owner (LP) — possible multi-parcel play.",
    },
    {
      apn: "040303000", address: "1301 Wertland St", lat: 38.034512, lng: -78.497986,
      score: 71, price: 1077800, beds: "MF (~8 bd*)", zone: "RX-5", byRoom: true, coc: 4.0, cocLow: 3.3, cocHigh: 4.6,
      owner: "Wertland 1301 LLC", ownerType: "LLC", absentee: true, lastSale: "$1,000,000 · 2024",
      flood: "X (minimal)", conf: 0.82, model: "by-room",
      components: { "campus proximity": 100, "by-room legal": 100, "cash-on-cash": 48, "owner motivation": 22, "risk penalty": 22 },
      financing: [{ s: "Cash / conventional", pitch: "Bought $1.0M in 2024 → low gain, market-rate loan. No creative edge.", guard: null, attorney: false }],
      suppressed: "Subject-To — recent arm's-length purchase, balance unverified, no rate gap.",
      distress: [], note: "Benchmark, not a buy: prime-block trophy priced like institutional MF.",
    },
    {
      apn: "040308000", address: "1215 Wertland St", lat: 38.034381, lng: -78.497287,
      score: 64, price: 235900, beds: "2 bd", zone: "RX-5", byRoom: true, coc: 4.4, cocLow: 3.6, cocHigh: 5.0,
      owner: "Coleman, Doris", ownerType: "Individual", absentee: false, lastSale: "$140,000 · 2003",
      flood: "X (minimal)", conf: 0.7, model: "by-room",
      components: { "campus proximity": 98, "by-room legal": 100, "cash-on-cash": 55, "owner motivation": 79, "risk penalty": 38 },
      financing: [{ s: "Seller finance", pitch: "21-yr owner, likely estate motivation — carry defers a large gain.", guard: "Owner-occupant + Dodd-Frank; estate sellers need extra care. Counsel required.", attorney: true }],
      suppressed: "Subject-To — condo with HOA, balance unverified.",
      distress: ["long tenure", "condo risk"], note: "Condo — verify by-room legality at the HOA level.",
    },
    {
      apn: "040309000", address: "1207-11 Wertland St", lat: 38.034210, lng: -78.497520,
      score: 38, price: 9880000, beds: "MF (24u)", zone: "RX-5", byRoom: true, coc: 1.7, cocLow: 1.3, cocHigh: 2.1,
      owner: "Heritage Student Living", ownerType: "Corp", absentee: true, lastSale: "$8,900,000 · 2021",
      flood: "X (minimal)", conf: 0.86, model: "whole-building",
      components: { "campus proximity": 100, "by-room legal": 100, "cash-on-cash": 8, "owner motivation": 10, "risk penalty": 30 },
      financing: [{ s: "Cash / institutional", pitch: "Institutional multifamily — out of the buy-box.", guard: null, attorney: false }],
      suppressed: "All creative finance — institutional seller, 1.7% cap.",
      distress: [], note: "Out of lane: institutional cap rate, not a one-operator deal.",
    },
  ].map((p) => ({ ...p, tier: tier(p.score) }));

  const changes = [
    { t: "price drop", icon: "ti-trending-down", txt: "1101 Grady Ave — assessed −4.2% ($400k → $383k)", color: "var(--positive)", apn: "060131000" },
    { t: "new score", icon: "ti-sparkles", txt: "Off-prime SFR scan: 12 parcels scored, 6 cross 78+", color: "var(--accent-bright)", apn: null },
    { t: "ownership", icon: "ti-user-share", txt: "1307 Gordon Ave — transferred into Patel Family LP", color: "var(--text-secondary)", apn: "060114000" },
    { t: "shortlist", icon: "ti-arrow-up-right", txt: "1022 Grady crossed into your top-3 (82)", color: "var(--score-strong-text)", apn: "060140000" },
  ];

  const briefQueues = [
    { q: "REGULATORY_KILL", label: "Regulatory kill", sev: "critical", rows: [
      { title: "RX-5 by-room litigation watch", reason: "White v. City settled Oct 2025 — reconfirm per-parcel before any close.", action: "Verify zoning", target: null },
    ]},
    { q: "ACT_ON_DEAL", label: "Act on deal", sev: "ok", rows: [
      { title: "1305 Grady Ave · 82", reason: "Top thesis fit, absentee LLC, 8-yr hold — strongest current candidate.", action: "→ Pipeline", target: "060123000" },
      { title: "1022 Grady Ave · 82", reason: "Tired-landlord signal; pencils 5.7% by-room.", action: "→ Pipeline", target: "060140000" },
    ]},
    { q: "ZONE_OPENED", label: "Zone opened", sev: "ok", rows: [
      { title: "RN-A corridor (Grady/Gordon)", reason: "By-room remains permitted; 12 fresh parcels scored this week.", action: "Source zone", target: null },
    ]},
    { q: "MAIL", label: "Mail this week", sev: "warn", rows: [
      { title: "Marcus Whitfield · 1101 Grady", reason: "Absentee, 13-yr hold — motivation 74. Compliant first-touch letter.", action: "Draft mailer", target: "060131000" },
      { title: "Doris Coleman · 1215 Wertland", reason: "21-yr owner, estate signal — gentle, no-pressure tone.", action: "Draft mailer", target: "040308000" },
    ]},
    { q: "VERIFY_ZONING", label: "Verify zoning", sev: "warn", rows: [
      { title: "1215 Wertland St (condo)", reason: "Confirm by-room legality at the HOA level before underwriting.", action: "Verify", target: "040308000" },
    ]},
  ];

  const leads = parcels
    .filter((p) => p.distress.length && p.score >= 60)
    .map((p) => ({
      apn: p.apn, owner: p.owner, address: p.address, motivation: p.components["owner motivation"],
      segment: p.absentee ? "absentee" : "owner-occupant", entity: p.ownerType,
      distress: p.distress, status: p.apn === "060131000" ? "mailed" : "queued", score: p.score, tier: p.tier,
    }))
    .sort((a, b) => b.motivation - a.motivation);

  const stages = ["watch", "analyzing", "offer", "under_contract", "owned", "passed"];
  const pipeline = {
    watch: [{ apn: "060118000", address: "1219 Gordon Ave", score: 81, tier: "strong", struct: "Cash" },
            { apn: "040303000", address: "1301 Wertland St", score: 71, tier: "strong", struct: "Cash" }],
    analyzing: [{ apn: "060123000", address: "1305 Grady Ave", score: 82, tier: "strong", struct: "Seller finance" },
                { apn: "060131000", address: "1101 Grady Ave", score: 81, tier: "strong", struct: "Seller finance" }],
    offer: [{ apn: "060140000", address: "1022 Grady Ave", score: 82, tier: "strong", struct: "Seller finance" }],
    under_contract: [{ apn: "060109000", address: "1414 Gordon Ave", score: 79, tier: "strong", struct: "Cash" }],
    owned: [],
    passed: [{ apn: "040309000", address: "1207-11 Wertland St", score: 38, tier: "weak", struct: "—" }],
  };

  window.LOT_DATA = {
    market: "Charlottesville", center: [38.0372, -78.4958], zoom: 15,
    thesis: "by-room · all-cash · ≥8% CoC · ≤1mi to grounds",
    parcels, changes, briefQueues, leads, stages, pipeline, tier,
    // by-room-legal zone polygon + UVA grounds marker
    zone: [[38.0414, -78.4985],[38.0408, -78.4910],[38.0335, -78.4918],[38.0335, -78.4992],[38.0405, -78.5010]],
    uva: [38.0356, -78.5034],
    stats: { matches: 23, medianCoc: "4.6%", byRoomLegal: "91%", mailed: 14 },
  };
})();
