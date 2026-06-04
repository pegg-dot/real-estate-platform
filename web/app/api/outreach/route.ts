import { sql } from "../../lib/db";
import { currentUserId } from "../../lib/user";

export const dynamic = "force-dynamic";

// Outreach history: the mailers you've approved/sent, with their compliance receipt. Owner-scoped.
export async function GET() {
  const uid = await currentUserId();
  const outreach = await sql()<Array<{ subject: string | null; status: string; created_at: string;
    owner_name: string | null; address: string | null; gate_snapshot: unknown }>>`
    select oe.subject, oe.status, oe.created_at, o.name as owner_name, p.address, oe.gate_snapshot
    from outreach_event oe
    join owner o on o.id = oe.owner_id
    left join lead l on l.id = oe.lead_id
    left join property p on p.id = l.property_id
    where oe.user_id = ${uid}
    order by oe.created_at desc limit 100`;
  return Response.json({ outreach });
}
