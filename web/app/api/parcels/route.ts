import { sql, MARKET } from "../../lib/db";

// GeoJSON of scored parcels (the map's data source), with optional NL-derived filters.
export const dynamic = "force-dynamic";

const UVA = { lat: 38.0356, lng: -78.5036 };
function miles(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 3958.8, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const num = (k: string) => (q.get(k) != null && q.get(k) !== "" ? Number(q.get(k)) : null);
  const bool = (k: string) => q.get(k) === "true";

  const minScore = num("minScore"), maxPrice = num("maxPrice"), minBeds = num("minBeds");
  const byRoomOnly = bool("byRoomLegalOnly"), absenteeOnly = bool("absenteeOnly"), distressOnly = bool("distressOnly");
  const developOnly = bool("developOnly");   // the development-upside layer (spec 020)
  const lens = q.get("lens") ?? "best_use";  // map color lens (spec 021): best_use|cash_flow|appreciation|by_room|score
  const maxDist = num("maxDistanceMiles");

  const rows = await sql()<Array<{
    apn: string; address: string | null; lat: number; lng: number; score: number;
    headline_coc: number | null; by_room_legal: boolean | null; gate_passed: boolean;
    est_market_value: string | null; beds: number | null; is_absentee: boolean | null;
    recommended_structure: string | null; recommended_use: string | null;
    exit_strategy: string | null; exit_strategies: unknown; components: unknown; distress: boolean;
  }>>`
    select g.apn, g.address, g.lat, g.lng, g.score, g.headline_coc, g.by_room_legal, g.gate_passed,
           g.est_market_value, g.beds, g.is_absentee, g.recommended_structure,
           g.recommended_use, g.recommended_exit_strategy as exit_strategy,
           g.exit_strategies, g.components,
           exists(select 1 from distress_signal ds where ds.property_id = g.id) as distress
    from deal_genome g
    where g.market = ${MARKET} and g.score is not null and g.lat is not null and g.lng is not null
      and g.low_confidence = false
      and (${minScore}::numeric is null or g.score >= ${minScore})
      and (${maxPrice}::numeric is null or g.est_market_value <= ${maxPrice})
      and (${minBeds}::int is null or g.beds >= ${minBeds})
      and (${byRoomOnly} = false or g.by_room_legal is true)
      and (${absenteeOnly} = false or g.is_absentee is true)`;

  // map a cash-on-cash to the 0..100 color scale (12% CoC = full green), to compare with the 003 score
  const cocColor = (coc: number | null) => (coc == null ? 0 : Math.max(0, Math.min(100, (coc / 0.12) * 100)));

  const features = rows
    .filter((r) => (!distressOnly || r.distress))
    .filter((r) => (!developOnly || r.recommended_use === "develop"))
    .filter((r) => (maxDist == null || miles(r.lat, r.lng, UVA.lat, UVA.lng) <= maxDist))
    .map((r) => {
      const ranked = ((r.exit_strategies as { ranked?: Array<{ strategy: string; cashOnCash: number }> })?.ranked) ?? [];
      const bestUseCoc = ranked.find((s) => s.strategy === r.exit_strategy)?.cashOnCash ?? (r.headline_coc != null ? Number(r.headline_coc) : null);
      const cashFlowCoc = ranked.length ? Math.max(...ranked.map((s) => s.cashOnCash)) : (r.headline_coc != null ? Number(r.headline_coc) : null);
      const byRoomCoc = ranked.find((s) => s.strategy === "by_room")?.cashOnCash ?? null;
      const appreciation = Number((r.components as { appreciation_potential?: { raw?: number } })?.appreciation_potential?.raw ?? 0);
      // the value that colors the dot, per the selected lens (default best-use = use-neutral)
      const colorValue =
        lens === "score" ? Number(r.score) :
        lens === "appreciation" ? appreciation * 100 :
        lens === "by_room" ? cocColor(byRoomCoc) :
        lens === "cash_flow" ? cocColor(cashFlowCoc) :
        cocColor(bestUseCoc);
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [r.lng, r.lat] },
        properties: {
          apn: r.apn, address: r.address, score: Number(r.score), colorValue,
          coc: r.headline_coc != null ? Number(r.headline_coc) : null,
          bestUseCoc, cashFlowCoc, byRoomCoc, appreciation,
          byRoom: r.by_room_legal, gatePassed: r.gate_passed,
          structure: r.recommended_structure, use: r.recommended_use,
          exitStrategy: r.exit_strategy, distress: r.distress,
        },
      };
    });

  return Response.json({ type: "FeatureCollection", features, lens }, { headers: { "cache-control": "no-store" } });
}
