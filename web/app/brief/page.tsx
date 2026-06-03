"use client";
/* Brief — restyled to the design system (kit BriefScreen). Visual only; all data wiring
   (load, runAction → /api/actions, /api/brief) preserved. */
import { useEffect, useState } from "react";

interface Row { queue: string; title: string; reason: string; action: string; target: string }
interface Brief { rows: Row[]; summary: string; error?: string }

const QUEUE_LABEL: Record<string, string> = {
  REGULATORY_KILL: "🔴 Regulatory kill", ACT_ON_DEAL: "📋 Act on deal",
  ZONE_OPENED: "🟢 Zone opened", MAIL: "✉️ Mail this week", VERIFY_ZONING: "🔍 Verify zoning",
};
// the queue's left accent bar color (severity at a glance)
const QUEUE_BAR: Record<string, string> = {
  REGULATORY_KILL: "var(--critical)", ACT_ON_DEAL: "var(--accent)", ZONE_OPENED: "var(--positive)",
  MAIL: "var(--accent)", VERIFY_ZONING: "var(--warn)",
};

export default function BriefPage() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ key: string; text: string } | null>(null);

  const load = () => fetch("/api/brief").then((r) => r.json()).then(setBrief);
  useEffect(() => { load(); }, []);

  async function runAction(key: string, body: Record<string, unknown>) {
    setBusy(key); setResult(null);
    const r = await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((x) => x.json());
    setBusy(null);
    setResult({ key, text: r.ok ? r.output : `⚠️ ${r.error}` });
    if (r.ok) load();
  }

  if (!brief) return <div className="page"><p className="muted">Loading the brief…</p></div>;

  const byQueue = (q: string) => brief.rows.filter((r) => r.queue === q);
  const queues = ["REGULATORY_KILL", "ACT_ON_DEAL", "ZONE_OPENED", "MAIL", "VERIFY_ZONING"];

  return (
    <div className="page">
      <div className="screen-head"><h1>The Monday Brief</h1></div>
      <p style={{ marginBottom: 8, whiteSpace: "pre-wrap" }}>{brief.summary}</p>
      {brief.error && <div style={{ background: "var(--critical-wash)", color: "var(--critical)", padding: "8px 10px", borderRadius: "var(--radius-sm)", marginBottom: 12 }}>⚠️ {brief.error}</div>}

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={() => runAction("gen", { action: "generate-leads" })} disabled={busy === "gen"} className="btn">
          {busy === "gen" ? "Generating…" : "↻ Generate leads"}
        </button>
        <button onClick={() => runAction("retune", { action: "propose-retune" })} disabled={busy === "retune"} className="btn">
          {busy === "retune" ? "Computing…" : "🧠 Propose thesis retune"}
        </button>
      </div>
      {result && <pre style={{ background: "var(--bg-chrome)", color: "var(--text-secondary)", padding: 12, borderRadius: "var(--radius-sm)", fontSize: 12, overflowX: "auto", marginBottom: 16, whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)", border: "1px solid var(--border-soft)" }}>{result.text}</pre>}

      {brief.rows.length === 0 && <p className="muted">Nothing needs action — the board is clear. Generate leads to fill the mail queue.</p>}

      {queues.map((q) => {
        const rows = byQueue(q);
        if (rows.length === 0) return null;
        return (
          <div key={q} className="queue">
            <div className="eyebrow" style={{ marginBottom: 7 }}>{QUEUE_LABEL[q] ?? q} <span className="muted">({rows.length})</span></div>
            {rows.map((r, i) => (
              <div key={i} className="queue-row">
                <span className="accent-bar" style={{ background: QUEUE_BAR[q] ?? "var(--accent)" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{r.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{r.reason}</div>
                </div>
                {q === "MAIL" && <button onClick={() => runAction(`draft-${r.target}`, { action: "draft-mailer", leadId: r.target })} disabled={busy === `draft-${r.target}`} className="btn btn-sm">✉️ Draft mailer</button>}
                {q === "ZONE_OPENED" && <button onClick={() => runAction("gen", { action: "generate-leads" })} className="btn btn-sm">↻ Source zone</button>}
                {q === "ACT_ON_DEAL" && <a href="/deals" className="btn btn-sm">→ Pipeline</a>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
