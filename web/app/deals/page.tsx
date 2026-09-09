import { sql, MARKET } from "../lib/db";
import PipelineBoard, { type PipelineDeal } from "./PipelineBoard";
export const dynamic = "force-dynamic";
export default async function DealsPage() {
  const deals = await sql()<PipelineDeal[]>`
    select d.id, d.stage::text as stage, p.address, p.apn, dg.score, d.updated_at,
           dg.recommended_structure
    from deal d
    join property p on p.id = d.property_id
    join market m on m.id = p.market_id
    left join deal_genome dg on dg.apn = p.apn and dg.market = ${MARKET}
    where m.name = ${MARKET}
    order by d.updated_at desc`;

  return <PipelineBoard deals={deals} />;
}
