import { sql, MARKET } from "../../lib/db";

// GeoJSON of every scored parcel with coords — the map's data source.
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await sql()<Array<{
    apn: string; address: string | null; lat: number; lng: number; score: number;
    headline_coc: number | null; by_room_legal: boolean | null; gate_passed: boolean;
    low_confidence: boolean; recommended_structure: string | null;
  }>>`
    select apn, address, lat, lng, score, headline_coc, by_room_legal, gate_passed,
           low_confidence, recommended_structure
    from deal_genome
    where market = ${MARKET} and score is not null and lat is not null and lng is not null
      and low_confidence = false`;

  const features = rows.map((r) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [r.lng, r.lat] },
    properties: {
      apn: r.apn, address: r.address, score: Number(r.score),
      coc: r.headline_coc != null ? Number(r.headline_coc) : null,
      byRoom: r.by_room_legal, gatePassed: r.gate_passed,
      structure: r.recommended_structure,
    },
  }));

  return Response.json({ type: "FeatureCollection", features },
    { headers: { "cache-control": "no-store" } });
}
