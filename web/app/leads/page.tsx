import { sql, MARKET } from "../lib/db";
import LeadActions from "./LeadActions";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await sql()<Array<{ id: string; motivation_score: number; stack_score: number | null;
    motivation_type: string | null; likely_bunny: string | null; recommended_structure: string | null;
    bunny_confidence: string | null; approach: string | null; method: string | null; segment: string | null; status: string;
    owner_name: string | null; address: string | null; distress: boolean }>>`
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
  const spend = (f?.mailed ?? 0) * 1.12;                                // $1 mail + 12c skip-trace / mailed
  const costPerDeal = f && f.closes > 0 ? `$${Math.round(spend / f.closes).toLocaleString()}` : "—";

  return (
    <div className="page">
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Leads — top motivated, by-room-legal owners</h1>
      <p className="muted" style={{ marginBottom: 14 }}>
        Mailable owners ranked by the STACK score (motivated-seller composite + equity + small-portfolio).
        {leads.length === 0 && " — none yet: run `npm run leads -- --generate`."}
      </p>
      <div className="muted" style={{ marginBottom: 14, fontSize: 12 }}>
        Funnel: <strong>{f?.leads ?? 0}</strong> mailable · <strong>{f?.mailed ?? 0}</strong> mailed ·
        <strong> {f?.closes ?? 0}</strong> closed · cost/deal <strong>{costPerDeal}</strong>
        <span style={{ marginLeft: 6 }}>(mail $1 + skip-trace 12¢ per touch — config)</span>
      </div>
      {leads.length > 0 && (
        <table>
          <thead><tr><th>Stack</th><th>Property</th><th>Owner</th><th>Motivation → bunny</th><th>Structure</th><th>Channel</th><th>Distress</th><th>Actions</th></tr></thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td><strong>{l.stack_score ?? l.motivation_score}</strong></td>
                <td>{l.address ?? "—"}</td>
                <td>{l.owner_name ?? "—"}</td>
                <td className="muted">{(l.motivation_type ?? l.segment ?? "—").replace(/_/g, " ")}{l.likely_bunny && l.likely_bunny !== "none" ? ` → ${l.likely_bunny.replace(/_/g, " ")}` : ""}</td>
                <td className="muted">
                  {(l.recommended_structure ?? "—").replace(/_/g, " ")}
                  {l.recommended_structure === "subject_to" && (
                    <span title="Subject-to carries due-on-sale risk (Garn-St-Germain trust caveat) — see an attorney; never present as risk-free." style={{ color: "#b45309" }}> ⚖️</span>
                  )}
                  {l.bunny_confidence != null && <span style={{ fontSize: 10 }}> ({Math.round(Number(l.bunny_confidence) * 100)}%)</span>}
                </td>
                <td className="muted">{l.approach ?? "—"}{l.method ? ` · ${l.method}` : ""}</td>
                <td>{l.distress ? <span className="pill flag">neglect</span> : <span className="muted">—</span>}</td>
                <td><LeadActions leadId={l.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
