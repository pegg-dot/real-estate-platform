"use client";
import { useEffect, useState } from "react";

interface Row { queue: string; title: string; reason: string; action: string; target: string }
interface Brief { rows: Row[]; summary: string; error?: string }

const QUEUE_LABEL: Record<string, string> = {
  REGULATORY_KILL: "🔴 Regulatory kill", ACT_ON_DEAL: "📋 Act on deal",
  ZONE_OPENED: "🟢 Zone opened", MAIL: "✉️ Mail this week", VERIFY_ZONING: "🔍 Verify zoning",
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
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>The Monday Brief</h1>
      <p style={{ marginBottom: 8, whiteSpace: "pre-wrap" }}>{brief.summary}</p>
      {brief.error && <div style={{ background: "#fee2e2", color: "#991b1b", padding: "8px 10px", borderRadius: 6, marginBottom: 12 }}>⚠️ {brief.error}</div>}

      <div style={{ marginBottom: 14 }}>
        <button onClick={() => runAction("gen", { action: "generate-leads" })} disabled={busy === "gen"} style={btn}>
          {busy === "gen" ? "Generating…" : "↻ Generate leads"}
        </button>
        <button onClick={() => runAction("retune", { action: "propose-retune" })} disabled={busy === "retune"} style={btn}>
          {busy === "retune" ? "Computing…" : "🧠 Propose thesis retune"}
        </button>
      </div>
      {result && <pre style={{ background: "#0f172a", color: "#e2e8f0", padding: 12, borderRadius: 6, fontSize: 12, overflowX: "auto", marginBottom: 16, whiteSpace: "pre-wrap" }}>{result.text}</pre>}

      {brief.rows.length === 0 && <p className="muted">Nothing needs action — the board is clear. Generate leads to fill the mail queue.</p>}

      {queues.map((q) => {
        const rows = byQueue(q);
        if (rows.length === 0) return null;
        return (
          <div key={q} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#475569", marginBottom: 6 }}>{QUEUE_LABEL[q] ?? q} <span className="muted">({rows.length})</span></div>
            {rows.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#f8fafc", borderRadius: 6, marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{r.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{r.reason}</div>
                </div>
                {q === "MAIL" && <button onClick={() => runAction(`draft-${r.target}`, { action: "draft-mailer", leadId: r.target })} disabled={busy === `draft-${r.target}`} style={btnSm}>✉️ Draft mailer</button>}
                {q === "ZONE_OPENED" && <button onClick={() => runAction("gen", { action: "generate-leads" })} style={btnSm}>↻ Source zone</button>}
                {q === "ACT_ON_DEAL" && <a href="/deals" style={{ ...btnSm, textDecoration: "none" }}>→ Pipeline</a>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

const btn: React.CSSProperties = { marginRight: 8, padding: "7px 14px", border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 };
const btnSm: React.CSSProperties = { padding: "5px 10px", border: "1px solid #cbd5e1", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" };
