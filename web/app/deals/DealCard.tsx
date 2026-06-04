"use client";
/* Pipeline card. Advancing/passing a deal now captures WHY (a reason chip): TASTE reasons feed the
   LEARN loop (they move the thesis weights over time); EXOGENOUS reasons are logged but excluded so
   the model never learns noise. Without this capture the learning loop never fires — every decision
   was previously unlabeled (advance) or hardcoded no_time (pass), so nothing was thesis-relevant. */
import { useState } from "react";

const NEXT: Record<string, string> = {
  watch: "analyzing", analyzing: "offer", offer: "under_contract", under_contract: "owned", owned: "exited",
};

// reason chips, with friendly labels. ✓ = taste (feeds learning), ○ = exogenous (logged, not learned).
const ADVANCE_REASONS: Array<[string, string]> = [
  ["great_cash_flow", "✓ great cash flow"], ["strong_location", "✓ strong location"],
  ["by_room_upside", "✓ by-room upside"], ["owner_motivated_fit", "✓ motivated owner"],
  ["off_market_opportunity", "○ just moving it along"],
];
const PASS_REASONS: Array<[string, string]> = [
  ["cash_flow_thin", "✓ cash flow too thin"], ["too_much_management", "✓ too much management"],
  ["appreciation_weak", "✓ weak appreciation"], ["risk_too_high", "✓ risk too high"],
  ["price_too_high_now", "○ price too high now"], ["seller_wont_engage", "○ seller won't engage"],
  ["no_time", "○ no time / other"],
];

export default function DealCard({ dealId, stage, address, score, structure }:
  { dealId: string; stage: string; address: string | null; score: number | null; structure: string | null }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState<null | "advance" | "pass">(null);   // which reason picker is open

  async function go(body: Record<string, unknown>) {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((x) => x.json());
    setBusy(false);
    if (r.ok) location.reload(); else setMsg(`⚠️ ${r.error}`.slice(0, 90));
  }

  const next = NEXT[stage];
  const terminal = stage === "passed" || stage === "exited";
  const reasons = pending === "advance" ? ADVANCE_REASONS : PASS_REASONS;

  return (
    <div className="kanban-card">
      <div className="addr">{address ?? "—"}</div>
      <div className="muted mono" style={{ fontSize: 10.5 }}>{score != null ? `score ${Math.round(Number(score))}` : ""}{structure ? ` · ${structure.replace(/_/g, " ")}` : ""}</div>

      {!terminal && pending === null && (
        <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
          {next && <button onClick={() => setPending("advance")} disabled={busy} className="btn btn-sm">→ {next.replace(/_/g, " ")}</button>}
          <button onClick={() => setPending("pass")} disabled={busy} className="btn btn-sm btn-danger">pass</button>
        </div>
      )}

      {!terminal && pending !== null && (
        <div style={{ marginTop: 7 }}>
          <div className="muted" style={{ fontSize: 10.5, marginBottom: 4 }}>
            {pending === "advance" ? `Why advance to ${next?.replace(/_/g, " ")}?` : "Why pass?"} <span style={{ opacity: 0.7 }}>(✓ teaches the model)</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {reasons.map(([chip, label]) => (
              <button key={chip} disabled={busy} className="btn btn-sm" style={{ fontSize: 10.5, padding: "3px 7px" }}
                onClick={() => go(pending === "advance"
                  ? { action: "transition-deal", dealId, toStage: next, reason: chip }
                  : { action: "transition-deal", dealId, pass: true, reason: chip })}>
                {label}
              </button>
            ))}
            <button disabled={busy} className="btn btn-sm" style={{ fontSize: 10.5, padding: "3px 7px", opacity: 0.6 }} onClick={() => setPending(null)}>cancel</button>
          </div>
        </div>
      )}

      {msg && <div style={{ color: "var(--critical)", marginTop: 4, fontSize: 11 }}>{msg}</div>}
    </div>
  );
}
