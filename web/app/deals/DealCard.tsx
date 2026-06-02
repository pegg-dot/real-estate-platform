"use client";
import { useState } from "react";

const NEXT: Record<string, string> = {
  watch: "analyzing", analyzing: "offer", offer: "under_contract", under_contract: "owned", owned: "exited",
};

export default function DealCard({ dealId, stage, address, score, structure }:
  { dealId: string; stage: string; address: string | null; score: number | null; structure: string | null }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function go(body: Record<string, unknown>) {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((x) => x.json());
    setBusy(false);
    if (r.ok) location.reload(); else setMsg(`⚠️ ${r.error}`.slice(0, 90));
  }

  const next = NEXT[stage];
  const terminal = stage === "passed" || stage === "exited";
  return (
    <div style={{ background: "#fff", borderRadius: 6, padding: "6px 8px", marginBottom: 6, fontSize: 12, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
      <div style={{ fontWeight: 600 }}>{address ?? "—"}</div>
      <div className="muted">{score != null ? `score ${Math.round(Number(score))}` : ""}{structure ? ` · ${structure.replace(/_/g, " ")}` : ""}</div>
      {!terminal && (
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          {next && <button onClick={() => go({ action: "transition-deal", dealId, toStage: next })} disabled={busy} style={mini}>→ {next.replace(/_/g, " ")}</button>}
          <button onClick={() => go({ action: "transition-deal", dealId, pass: true })} disabled={busy} style={{ ...mini, color: "#991b1b" }}>pass</button>
        </div>
      )}
      {msg && <div style={{ color: "#991b1b", marginTop: 4, fontSize: 11 }}>{msg}</div>}
    </div>
  );
}

const mini: React.CSSProperties = { padding: "3px 8px", border: "1px solid #cbd5e1", borderRadius: 5, background: "#f8fafc", cursor: "pointer", fontSize: 11, fontWeight: 600 };
