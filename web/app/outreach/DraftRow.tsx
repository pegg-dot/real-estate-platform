"use client";
/* An email draft from the Outreach Writer (spec 025-B). Expandable card; the Send button sends via
   the connected user's Gmail (gmail.send) when a connector is wired, else explains how to connect. */
import { useState } from "react";

interface Draft { id: string; to_addr: string | null; subject: string; body: string; status: string; created_at: string; address: string | null }

export default function DraftRow({ draft }: { draft: Draft }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(draft.status);
  const [sending, setSending] = useState(false);
  async function send() {
    if (sending || status === "sent") return;
    if (!confirm(`Send this email${draft.to_addr ? ` to ${draft.to_addr}` : ""}? It goes out from your connected Gmail.`)) return;
    setSending(true);
    const r = await fetch("/api/outreach/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: draft.id }) })
      .then((x) => x.json()).catch(() => ({ ok: false, error: "network error" }));
    setSending(false);
    if (r.ok) setStatus("sent");
    alert(r.ok ? (r.output ?? "✓ sent") : `⚠️ ${r.error}`);
  }
  return (
    <div className="card">
      <div onClick={() => setOpen((o) => !o)} style={{ cursor: "pointer", display: "flex", gap: 9, alignItems: "center" }}>
        <i className="ti ti-mail" style={{ color: "var(--accent-bright)", fontSize: 16 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{draft.subject}</div>
          <div className="muted mono" style={{ fontSize: 11 }}>{draft.to_addr || "no recipient yet"}{draft.address ? ` · ${draft.address}` : ""} · {String(draft.created_at).slice(0, 10)}</div>
        </div>
        <span className="pill">{status}</span>
        <i className={`ti ti-chevron-${open ? "up" : "down"}`} style={{ color: "var(--text-tertiary)" }} />
      </div>
      {open && (
        <div style={{ marginTop: 10 }}>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--text-secondary)", background: "var(--bg-base)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-sm)", padding: 11 }}>{draft.body}</pre>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button className="btn-primary btn-sm" onClick={send} disabled={sending || status === "sent"}>
              {status === "sent" ? "✓ Sent" : sending ? "Sending…" : "Send"}
            </button>
            <span className="muted" style={{ fontSize: 11, alignSelf: "center" }}>
              {status === "sent" ? "sent via your Gmail" : "sends from your connected Gmail (Settings → Connect) · CAN-SPAM-compliant · you approve each"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
