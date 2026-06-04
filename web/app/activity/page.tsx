import { sql } from "../lib/db";
import { currentUserId } from "../lib/user";

export const dynamic = "force-dynamic";

const ICON: Record<string, string> = {
  "email.send": "✉️", "calendar.sync": "📅", "deal.transition": "📋",
  "automation.tick": "🔄", "engine.action": "⚙️",
};
const STATUS: Record<string, string> = { ok: "var(--positive)", blocked: "var(--warn)", error: "var(--critical)" };

// Inspector / audit ledger — what the system, agents, and automations actually did, with outcomes.
// Closes the "fire-and-forget, invisible after the fact" gap the audit flagged.
export default async function ActivityPage() {
  const uid = await currentUserId();
  const rows = await sql()<Array<{ actor: string; action: string; target: string | null; status: string;
    detail: Record<string, unknown>; created_at: string }>>`
    select actor, action, target, status, detail, to_char(created_at, 'YYYY-MM-DD HH24:MI') as created_at
    from action_log where user_id = ${uid} order by created_at desc limit 200`;

  return (
    <div className="page">
      <div className="screen-head"><h1>Activity</h1><span className="sub">what the system, agents & automations did — the audit ledger</span></div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
        Every send, calendar sync, deal decision, and engine/automation run is recorded here with its outcome.
        {rows.length === 0 && " Nothing logged yet — actions appear here as you (or the automations) take them."}
      </p>
      {rows.length > 0 && (
        <div className="tablewrap"><table>
          <thead><tr><th>When</th><th>Action</th><th>Re</th><th>By</th><th>Result</th><th>Detail</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>{r.created_at}</td>
                <td>{ICON[r.action.split(".").slice(0, 2).join(".")] ?? ICON[r.action] ?? "•"} {r.action.replace(/\./g, " ")}</td>
                <td className="muted mono" style={{ fontSize: 11 }}>{r.target ?? "—"}</td>
                <td className="muted">{r.actor}</td>
                <td><span className="pill" style={{ color: STATUS[r.status] ?? "var(--text-secondary)" }}>{r.status}</span></td>
                <td className="muted" style={{ fontSize: 11, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {Object.entries(r.detail ?? {}).map(([k, v]) => `${k}: ${String(v)}`).join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
