import { sql, MARKET } from "../../lib/db";

export const dynamic = "force-dynamic";

// The deal panel's data — the full scored row from deal_genome for one parcel.
export async function GET(req: Request) {
  const apn = new URL(req.url).searchParams.get("apn");
  if (!apn) return Response.json({ error: "apn required" }, { status: 400 });

  const [row] = await sql()<Array<Record<string, unknown>>>`
    select apn, address, zone_code, by_room_legal, beds, est_market_value, latest_assessed,
           score, headline_model, headline_coc, coc_low, coc_high, data_confidence,
           recommended_structure, gate_passed, gate_failures, low_confidence,
           owner_name, owner_entity_type, is_absentee, tenure_years,
           last_arms_price, last_arms_date, flood_zone, components, financing
    from deal_genome where market = ${MARKET} and apn = ${apn} limit 1`;

  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(row, { headers: { "cache-control": "no-store" } });
}
