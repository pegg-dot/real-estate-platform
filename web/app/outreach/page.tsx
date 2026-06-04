import { sql } from "../lib/db";
import { currentUserId } from "../lib/user";
import DraftRow from "./DraftRow";

export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  const uid = await currentUserId();
  const rows = await sql()<Array<{ subject: string | null; status: string; created_at: string;
    owner_name: string | null; address: string | null; gate_snapshot: { passed?: boolean } | null }>>`
    select oe.subject, oe.status, oe.created_at, o.name as owner_name, p.address, oe.gate_snapshot
    from outreach_event oe
    join owner o on o.id = oe.owner_id
    left join lead l on l.id = oe.lead_id
    left join property p on p.id = l.property_id
    where oe.user_id = ${uid}
    order by oe.created_at desc limit 100`;

  // spec 025-B: email drafts the Outreach Writer agent produced, awaiting review/send
  const drafts = await sql()<Array<{ id: string; to_addr: string | null; subject: string; body: string; status: string; created_at: string; address: string | null }>>`
    select d.id, d.to_addr, d.subject, d.body, d.status, d.created_at, p.address
    from email_draft d
    left join lead l on l.id = d.lead_id
    left join property p on p.id = l.property_id
    where d.user_id = ${uid}
    order by d.created_at desc limit 50`;

  return (
    <div className="page">
      <div className="screen-head"><h1>Outreach</h1><span className="sub">drafts to review + approved mailers</span></div>

      <h2>Email drafts <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>(from the Outreach Writer — review, edit, then send)</span></h2>
      {drafts.length === 0
        ? <p className="muted" style={{ fontSize: 13 }}>No drafts yet — open <a href="/chat">Chat</a>, pick the <strong>Outreach Writer</strong>, attach a lead, and approve a draft. Sending lights up when a Gmail connector is wired.</p>
        : <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>{drafts.map((d) => <DraftRow key={d.id} draft={d} />)}</div>}

      <h2>Approved mailers <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>(+ compliance receipt)</span></h2>
      {rows.length === 0
        ? <p className="muted" style={{ fontSize: 13 }}>None yet — approve one from the Brief or Leads (it runs the compliance gate).</p>
        : (
        <div className="tablewrap"><table>
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
        </table></div>
      )}
    </div>
  );
}
