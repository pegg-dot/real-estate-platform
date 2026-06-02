import { sql, MARKET } from "../lib/db";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await sql()<Array<{ motivation_score: number; segment: string | null; status: string;
    owner_name: string | null; address: string | null; distress: boolean }>>`
    select l.motivation_score, l.segment, l.status, o.name as owner_name, p.address,
           exists(select 1 from distress_signal ds where ds.property_id = l.property_id) as distress
    from lead l
    join market m on m.id = l.market_id
    join owner o on o.id = l.owner_id
    left join property p on p.id = l.property_id
    where m.name = ${MARKET} and l.gate_state = 'mailable'
    order by l.motivation_score desc limit 60`;

  return (
    <div className="page">
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Leads — top motivated, by-room-legal owners</h1>
      <p className="muted" style={{ marginBottom: 14 }}>
        Mailable owners ranked by motivation (hold-duration + absentee + entity + visible-neglect distress).
        {leads.length === 0 && " — none yet: run `npm run leads -- --generate`."}
      </p>
      {leads.length > 0 && (
        <table>
          <thead><tr><th>Score</th><th>Property</th><th>Owner</th><th>Segment</th><th>Distress</th><th>Status</th></tr></thead>
          <tbody>
            {leads.map((l, i) => (
              <tr key={i}>
                <td><strong>{l.motivation_score}</strong></td>
                <td>{l.address ?? "—"}</td>
                <td>{l.owner_name ?? "—"}</td>
                <td className="muted">{l.segment ?? "—"}</td>
                <td>{l.distress ? <span className="pill flag">neglect</span> : <span className="muted">—</span>}</td>
                <td className="muted">{l.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
