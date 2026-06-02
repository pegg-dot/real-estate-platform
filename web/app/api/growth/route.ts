import { sql, MARKET } from "../../lib/db";

export const dynamic = "force-dynamic";

// Growth-corridor heat layer (spec 017): one point per ~0.5km grid cell with its corridor score —
// the data the map renders as a "path of progress" overlay. (Visual styling is the design pass.)
export async function GET() {
  const areas = await sql()<Array<{ area_key: string; corridor_score: number; value_slope: string | null; median_value: string | null; parcels: number; confidence: string | null }>>`
    select area_key, corridor_score, value_slope, median_value, parcels, confidence
    from growth_area
    where market_id = (select id from market where name = ${MARKET}) and corridor_score is not null
    order by corridor_score desc`;

  const cells = areas.map((a) => {
    const [lat, lng] = a.area_key.split("_").map(Number);
    return {
      lat, lng, corridorScore: a.corridor_score, parcels: a.parcels,
      confidence: a.confidence != null ? Number(a.confidence) : null,   // down-weight low-confidence cells
      valueSlope: a.value_slope != null ? Number(a.value_slope) : null,
      medianValue: a.median_value != null ? Number(a.median_value) : null,
    };
  });

  // positioning signal, not a promise — appreciation is probabilistic (spec 017 honest flag)
  return Response.json({ cells, note: "Growth corridors are a positioning signal, not a promise; weight by confidence." }, { headers: { "cache-control": "no-store" } });
}
