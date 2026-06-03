"use client";
/* Pipeline card — restyled to the kit .kanban-card. Visual only; transition wiring preserved. */
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
    <div className="kanban-card">
      <div className="addr">{address ?? "—"}</div>
      <div className="muted mono" style={{ fontSize: 10.5 }}>{score != null ? `score ${Math.round(Number(score))}` : ""}{structure ? ` · ${structure.replace(/_/g, " ")}` : ""}</div>
      {!terminal && (
        <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
          {next && <button onClick={() => go({ action: "transition-deal", dealId, toStage: next })} disabled={busy} className="btn btn-sm">→ {next.replace(/_/g, " ")}</button>}
          <button onClick={() => go({ action: "transition-deal", dealId, pass: true })} disabled={busy} className="btn btn-sm btn-danger">pass</button>
        </div>
      )}
      {msg && <div style={{ color: "var(--critical)", marginTop: 4, fontSize: 11 }}>{msg}</div>}
    </div>
  );
}
