import { sql, MARKET } from "../../lib/db";

export const dynamic = "force-dynamic";

// Real rent comps that override the modeled $/bed in scoring.
export async function GET() {
  const comps = await sql()<Array<{ address: string | null; beds: number | null; rent_monthly: string | null;
    per_bed_rent: string | null; is_by_room: boolean; source: string; observed_at: string | null }>>`
    select rc.address, rc.beds, rc.rent_monthly, rc.per_bed_rent, rc.is_by_room, rc.source, rc.observed_at
    from rent_comp rc join market m on m.id = rc.market_id where m.name = ${MARKET}
    order by rc.created_at desc limit 200`;
  return Response.json({ comps });
}
