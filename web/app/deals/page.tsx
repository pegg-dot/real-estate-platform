import { sql, MARKET } from "../lib/db";
import DealCard from "./DealCard";

export const dynamic = "force-dynamic";
const STAGES = ["watch", "analyzing", "offer", "under_contract", "owned", "exited", "passed"];

export default async function DealsPage() {
  const deals = await sql()<Array<{ id: string; stage: string; address: string | null; score: number | null;
    updated_at: string; recommended_structure: string | null }>>`
    select d.id, d.stage::text as stage, p.address, dg.score, d.updated_at,
           dg.recommended_structure
    from deal d
    join property p on p.id = d.property_id
    join market m on m.id = p.market_id
    left join deal_genome dg on dg.apn = p.apn and dg.market = ${MARKET}
    where m.name = ${MARKET}
    order by d.updated_at desc`;

  const byStage = (s: string) => deals.filter((d) => d.stage === s);

  return (
    <div className="page wide">
      <div className="screen-head" style={{ padding: "0 16px" }}>
        <h1>Pipeline</h1>
        <span className="sub">the deal board{deals.length === 0 ? " — empty: a deal is born when an inbound reply is recorded" : ""}</span>
      </div>
      <div className="board">
        {STAGES.map((s) => {
          const items = byStage(s);
          return (
            <div key={s} className="col">
              <div className="col-head">
                <span className="eyebrow">{s.replace(/_/g, " ")}</span>
                <span className="muted mono" style={{ fontSize: 11 }}>{items.length}</span>
              </div>
              <div className="col-body">
                {items.map((d) => (
                  <DealCard key={d.id} dealId={d.id} stage={d.stage} address={d.address} score={d.score} structure={d.recommended_structure} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
