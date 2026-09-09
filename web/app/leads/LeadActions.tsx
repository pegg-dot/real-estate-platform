"use client";
import { useState } from "react";
import { addContext } from "../chat/contextStore";

interface Playbook {
  sections: Array<{ title: string; lines: string[] }>;
  citations: string[];
  note: string;
}

export default function LeadActions({ leadId, label }: { leadId: string; label?: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [added, setAdded] = useState(false);

  async function act(action: string) {
    if (busy) return;
    if (action === "record-inbound" && !confirm("Record that this owner has replied? This changes the lead and can create a pipeline deal.")) return;
    setBusy(action); setMsg(null);
    try {
      const response = await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, leadId }), signal: AbortSignal.timeout(180000) });
      const r = await response.json();
      if (!response.ok || !r.ok) throw new Error("not confirmed");
      if (action === "coach") setPlaybook(JSON.parse(r.output) as Playbook);
      else setMsg(action === "draft-mailer" ? "Draft prepared. Review it in Outreach." : "Inbound reply recorded.");
    } catch { setMsg("Action not confirmed. Check Activity before retrying."); }
    finally { setBusy(null); }

  }

  return (
    <div className="lead-action-group">
      <button onClick={() => act("draft-mailer")} disabled={!!busy} className="btn btn-sm">{busy === "draft-mailer" ? "…" : "✉ Draft"}</button>
      <button onClick={() => act("coach")} disabled={!!busy} className="btn btn-sm">{busy === "coach" ? "…" : " Coach"}</button>
      <button onClick={() => act("record-inbound")} disabled={!!busy} className="btn btn-sm">{busy === "record-inbound" ? "…" : "Record reply"}</button>
      <button title="Attach this lead to the chat (then open Chat and ask the Coach/Operator about it)"
        onClick={() => { addContext({ type: "lead", id: leadId, label: label ?? leadId }); setAdded(true); setTimeout(() => setAdded(false), 1800); }}
        className="btn btn-sm">{added ? "✓ added" : " Chat"}</button>
      {msg && <span role="status" className="muted" style={{ fontSize: 11 }}>{msg}</span>}
      {playbook && (
        <div style={{ flexBasis: "100%", marginTop: 8, padding: 10, border: "1px solid var(--border-soft)", borderRadius: "var(--radius-sm)", background: "var(--bg-panel)", fontSize: 12 }}>
          <button aria-label="Close negotiation playbook" onClick={() => setPlaybook(null)} style={{ float: "right", border: "none", background: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16 }}>×</button>
          {playbook.sections.map((s, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <strong>{s.title}</strong>
              {s.lines.map((l, j) => <div key={j} className="muted">{l}</div>)}
            </div>
          ))}
          {playbook.citations.length > 0 && <div className="muted" style={{ fontSize: 11 }}>cites: {playbook.citations.join(", ")}</div>}
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{playbook.note}</div>
        </div>
      )}
    </div>
  );
}
