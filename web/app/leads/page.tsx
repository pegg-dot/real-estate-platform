import { sql, MARKET } from "../lib/db";
import LeadsTable, { type LeadRecord } from "./LeadsTable";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await sql()<LeadRecord[]>`
    select l.id, l.motivation_score, l.stack_score, l.motivation_type, l.likely_bunny,
           l.recommended_structure, l.bunny_confidence, l.approach, l.method, l.segment, l.status,
           o.name as owner_name, p.address,
           exists(select 1 from distress_signal ds where ds.property_id = l.property_id) as distress
    from lead l
    join market m on m.id = l.market_id
    join owner o on o.id = l.owner_id
    left join property p on p.id = l.property_id
    where m.name = ${MARKET} and l.gate_state = 'mailable'
    order by l.stack_score desc nulls last, l.motivation_score desc limit 60`;

  // funnel KPIs (spec 015 Part A): leads -> mailed -> deals by stage, with config cost-per-deal
  const [f] = await sql()<Array<{ leads: number; mailed: number; closes: number }>>`
    with mk as (select id from market where name = ${MARKET})
    select
      (select count(*)::int from lead where market_id=(select id from mk) and gate_state='mailable') as leads,
      (select count(*)::int from lead where market_id=(select id from mk) and times_mailed>0) as mailed,
      (select count(*)::int from deal d join property p on p.id=d.property_id
         where p.market_id=(select id from mk) and d.stage in ('owned','exited')) as closes`;
  return <LeadsTable leads={leads} counts={f ?? { leads: 0, mailed: 0, closes: 0 }} />;
}
