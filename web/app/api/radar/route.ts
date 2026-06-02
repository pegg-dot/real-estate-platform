import { sql, MARKET } from "../../lib/db";

export const dynamic = "force-dynamic";

// Regulatory radar: zoning changes as opportunity/risk alpha + the current rule set.
export async function GET() {
  const events = await sql()<Array<{ zone_code: string; change_type: string; direction: string | null;
    affected_parcel_count: number; alpha_note: string | null; created_at: string }>>`
    select re.zone_code, re.change_type, re.detail->>'direction' as direction, re.affected_parcel_count,
           re.alpha_note, re.created_at
    from regulatory_event re join market m on m.id = re.market_id
    where m.name = ${MARKET} order by re.created_at desc limit 50`;

  const rules = await sql()<Array<{ zone_code: string; by_room_legal: boolean; max_unrelated_occupants: number | null; stability_flag: string | null }>>`
    select zone_code, by_room_legal, max_unrelated_occupants, stability_flag
    from zoning_rule zr join market m on m.id = zr.market_id where m.name = ${MARKET} order by zone_code`;

  return Response.json({ events, rules });
}
