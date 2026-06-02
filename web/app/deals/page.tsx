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
    <div className="page">
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Pipeline — the deal board</h1>
      <p className="muted" style={{ marginBottom: 14 }}>
        Every deal you're tracking, by stage.
        {deals.length === 0 && " — empty: a deal is born when an inbound reply is recorded (`npm run leads -- --inbound <leadId>`)."}
      </p>
      <div style={{ display: "flex", gap: 12, overflowX: "auto" }}>
        {STAGES.map((s) => {
          const items = byStage(s);
          return (
            <div key={s} style={{ minWidth: 190, background: "#f8fafc", borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#475569", marginBottom: 8 }}>
                {s.replace(/_/g, " ")} <span className="muted">({items.length})</span>
              </div>
              {items.map((d) => (
                <DealCard key={d.id} dealId={d.id} stage={d.stage} address={d.address} score={d.score} structure={d.recommended_structure} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
