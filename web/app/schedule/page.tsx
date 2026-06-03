import { sql } from "../lib/db";

export const dynamic = "force-dynamic";

const KIND_ICON: Record<string, string> = { call: "📞", follow_up: "↩️", visit: "🏠", deadline: "⏰", other: "•" };

// Scheduled events (spec 025-C) the Scheduler agent proposed + you approved. Calendar sync is a
// later connector; this is the in-app schedule.
export default async function SchedulePage() {
  const events = await sql()<Array<{ id: string; title: string; kind: string | null; starts_at: string | null;
    notes: string | null; status: string; address: string | null }>>`
    select e.id, e.title, e.kind, to_char(e.starts_at, 'YYYY-MM-DD') as starts_at, e.notes, e.status,
           coalesce(p.address, e.apn) as address
    from scheduled_event e
    left join lead l on l.id = e.lead_id
    left join property p on p.id = l.property_id
    order by e.starts_at asc nulls last limit 200`;

  return (
    <div className="page">
      <div className="screen-head"><h1>Schedule</h1><span className="sub">calls, follow-ups, visits + deadlines</span></div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
        Events the Scheduler agent proposed and you approved. {events.length === 0 && <>None yet — open <a href="/chat">Chat</a>, pick the <strong>Scheduler</strong>, and approve an event.</>}
        {events.length > 0 && " Calendar sync lights up when the Google Calendar connector is wired."}
      </p>
      {events.length > 0 && (
        <div className="tablewrap"><table>
          <thead><tr><th>When</th><th>Kind</th><th>Title</th><th>Re</th><th>Notes</th><th>Status</th></tr></thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="mono">{e.starts_at ?? "—"}</td>
                <td>{KIND_ICON[e.kind ?? "other"] ?? "•"} {(e.kind ?? "other").replace(/_/g, " ")}</td>
                <td style={{ fontWeight: 600 }}>{e.title}</td>
                <td className="muted">{e.address ?? "—"}</td>
                <td className="muted">{e.notes ?? "—"}</td>
                <td><span className="pill">{e.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
