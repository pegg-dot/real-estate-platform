import { sql, MARKET } from "../lib/db";

export const dynamic = "force-dynamic";
const STAGES = ["watch", "analyzing", "offer", "under_contract", "owned", "exited", "passed"];

export default async function DealsPage() {
  const deals = await sql()<Array<{ stage: string; address: string | null; score: number | null;
    updated_at: string; recommended_structure: string | null }>>`
    select d.stage::text as stage, p.address, dg.score, d.updated_at,
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
              {items.map((d, i) => (
                <div key={i} style={{ background: "#fff", borderRadius: 6, padding: "6px 8px", marginBottom: 6, fontSize: 12, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontWeight: 600 }}>{d.address ?? "—"}</div>
                  <div className="muted">{d.score != null ? `score ${Math.round(Number(d.score))}` : ""} {d.recommended_structure ? `· ${d.recommended_structure.replace(/_/g, " ")}` : ""}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
