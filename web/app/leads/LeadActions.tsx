"use client";
import { useState } from "react";

export default function LeadActions({ leadId }: { leadId: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function act(action: string) {
    setBusy(action); setMsg(null);
    const r = await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, leadId }) }).then((x) => x.json());
    setBusy(null);
    setMsg(r.ok ? "✓ done" : `⚠️ ${String(r.error).slice(0, 36)}`);
  }

  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <button onClick={() => act("draft-mailer")} disabled={!!busy} style={mini}>{busy === "draft-mailer" ? "…" : "✉️ Draft"}</button>
      <button onClick={() => act("record-inbound")} disabled={!!busy} style={mini}>{busy === "record-inbound" ? "…" : "📥 Reply"}</button>
      {msg && <span className="muted" style={{ fontSize: 11 }}>{msg}</span>}
    </span>
  );
}
const mini: React.CSSProperties = { padding: "3px 8px", border: "1px solid #cbd5e1", borderRadius: 5, background: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600 };
