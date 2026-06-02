import { sql } from "../lib/db";

export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  const rows = await sql()<Array<{ subject: string | null; status: string; created_at: string;
    owner_name: string | null; address: string | null; gate_snapshot: { passed?: boolean } | null }>>`
    select oe.subject, oe.status, oe.created_at, o.name as owner_name, p.address, oe.gate_snapshot
    from outreach_event oe
    join owner o on o.id = oe.owner_id
    left join lead l on l.id = oe.lead_id
    left join property p on p.id = l.property_id
    order by oe.created_at desc limit 100`;

  return (
    <div className="page">
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Outreach — mailers you&apos;ve approved</h1>
      <p className="muted" style={{ marginBottom: 14 }}>Every approved mailer + its compliance receipt. {rows.length === 0 && "None yet — approve one from the Brief or Leads (it ran the compliance gate)."}</p>
      {rows.length > 0 && (
        <table>
          <thead><tr><th>Date</th><th>Property</th><th>Owner</th><th>Subject</th><th>Compliance</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="muted">{String(r.created_at).slice(0, 10)}</td>
                <td>{r.address ?? "—"}</td>
                <td>{r.owner_name ?? "—"}</td>
                <td>{r.subject ?? "—"}</td>
                <td>{r.gate_snapshot?.passed ? <span className="pill ok">passed</span> : <span className="muted">—</span>}</td>
                <td className="muted">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
