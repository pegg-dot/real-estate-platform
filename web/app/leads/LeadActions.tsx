"use client";
import { useState } from "react";

interface Playbook {
  sections: Array<{ title: string; lines: string[] }>;
  citations: string[];
  note: string;
}

export default function LeadActions({ leadId }: { leadId: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [playbook, setPlaybook] = useState<Playbook | null>(null);

  async function act(action: string) {
    setBusy(action); setMsg(null);
    const r = await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, leadId }) }).then((x) => x.json());
    setBusy(null);
    if (action === "coach" && r.ok) {
      try { setPlaybook(JSON.parse(r.output) as Playbook); setMsg(null); }
      catch { setMsg("⚠️ could not parse playbook"); }
      return;
    }
    setMsg(r.ok ? "✓ done" : `⚠️ ${String(r.error).slice(0, 36)}`);
  }

  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <button onClick={() => act("draft-mailer")} disabled={!!busy} className="btn btn-sm">{busy === "draft-mailer" ? "…" : "✉️ Draft"}</button>
      <button onClick={() => act("coach")} disabled={!!busy} className="btn btn-sm">{busy === "coach" ? "…" : "🎯 Coach"}</button>
      <button onClick={() => act("record-inbound")} disabled={!!busy} className="btn btn-sm">{busy === "record-inbound" ? "…" : "📥 Reply"}</button>
      {msg && <span className="muted" style={{ fontSize: 11 }}>{msg}</span>}
      {playbook && (
        <div style={{ flexBasis: "100%", marginTop: 8, padding: 10, border: "1px solid var(--border-soft)", borderRadius: "var(--radius-sm)", background: "var(--bg-panel)", fontSize: 12 }}>
          <button onClick={() => setPlaybook(null)} style={{ float: "right", border: "none", background: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 16 }}>×</button>
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
    </span>
  );
}
