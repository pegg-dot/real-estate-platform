import { sql, MARKET } from "../../lib/db";

export const dynamic = "force-dynamic";

// The weekly Scout diff: what changed since the previous run.
export async function GET() {
  const [run] = await sql()<Array<{ id: string; prev_run_id: string | null }>>`
    select rr.id, rr.prev_run_id from refresh_run rr join market m on m.id = rr.market_id
    where m.name = ${MARKET} and rr.finished_at is not null order by rr.started_at desc limit 1`;
  if (!run || !run.prev_run_id) return Response.json({ baseline: true, changes: [] });

  const changes = await sql()<Array<{ change_type: string; severity: string; detail: unknown; apn: string; address: string | null }>>`
    select ce.change_type, ce.severity, ce.detail, p.apn, p.address
    from change_event ce join property p on p.id = ce.property_id
    where ce.run_id = ${run.id}
    order by case ce.severity when 'high' then 0 when 'notable' then 1 else 2 end, ce.created_at desc
    limit 300`;
  return Response.json({ baseline: false, changes });
}
