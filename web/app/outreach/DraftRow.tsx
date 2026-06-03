"use client";
/* An email draft from the Outreach Writer (spec 025-B). Expandable card; the Send button is the
   connector seam — it stays gated until a Gmail/email transport is wired. */
import { useState } from "react";

interface Draft { id: string; to_addr: string | null; subject: string; body: string; status: string; created_at: string; address: string | null }

export default function DraftRow({ draft }: { draft: Draft }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card">
      <div onClick={() => setOpen((o) => !o)} style={{ cursor: "pointer", display: "flex", gap: 9, alignItems: "center" }}>
        <i className="ti ti-mail" style={{ color: "var(--accent-bright)", fontSize: 16 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{draft.subject}</div>
          <div className="muted mono" style={{ fontSize: 11 }}>{draft.to_addr || "no recipient yet"}{draft.address ? ` · ${draft.address}` : ""} · {String(draft.created_at).slice(0, 10)}</div>
        </div>
        <span className="pill">{draft.status}</span>
        <i className={`ti ti-chevron-${open ? "up" : "down"}`} style={{ color: "var(--text-tertiary)" }} />
      </div>
      {open && (
        <div style={{ marginTop: 10 }}>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--text-secondary)", background: "var(--bg-base)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-sm)", padding: 11 }}>{draft.body}</pre>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button className="btn-primary btn-sm" onClick={() => alert("Email transport isn't wired yet — add a Gmail/Resend connector to actually send. The draft is saved and CAN-SPAM-compliant; you approve every send.")}>Send</button>
            <span className="muted" style={{ fontSize: 11, alignSelf: "center" }}>connector not wired — review/edit ready</span>
          </div>
        </div>
      )}
    </div>
  );
}
