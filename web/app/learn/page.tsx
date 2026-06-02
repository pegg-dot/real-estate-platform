"use client";
import { useEffect, useState } from "react";

interface Report { note?: string; thesisRelevantCount?: number; advancedAvgScore?: number | null;
  passedAvgScore?: number | null; passedHighScorers?: number; advancedLowScorers?: number;
  proposeRetune?: boolean; error?: string }

export default function LearnPage() {
  const [r, setR] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);

  useEffect(() => { fetch("/api/learn").then((x) => x.json()).then(setR); }, []);

  async function propose() {
    setBusy(true); setOut(null);
    const x = await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "propose-retune" }) }).then((y) => y.json());
    setBusy(false); setOut(x.ok ? x.output : `⚠️ ${x.error}`);
  }

  if (!r) return <div className="page"><p className="muted">Loading…</p></div>;
  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Learn — the loop that sharpens your thesis</h1>
      <p className="muted" style={{ marginBottom: 12 }}>Every advance/pass teaches LOT your revealed preference. It reports the gap and proposes a weight change only once ~40 thesis-relevant decisions exist (then you approve it).</p>
      {r.error ? <div style={{ background: "#fee2e2", color: "#991b1b", padding: 10, borderRadius: 6 }}>⚠️ {r.error}</div> : (
        <>
          <p style={{ marginBottom: 12 }}>{r.note}</p>
          <div style={{ display: "flex", gap: 24, marginBottom: 14 }}>
            <Stat label="Decisions logged" value={String(r.thesisRelevantCount ?? 0)} />
            <Stat label="Advanced avg score" value={r.advancedAvgScore != null ? String(r.advancedAvgScore) : "—"} />
            <Stat label="Passed avg score" value={r.passedAvgScore != null ? String(r.passedAvgScore) : "—"} />
            <Stat label="Passed high-scorers" value={String(r.passedHighScorers ?? 0)} />
            <Stat label="Advanced low-scorers" value={String(r.advancedLowScorers ?? 0)} />
          </div>
          <button onClick={propose} disabled={busy} style={btn}>{busy ? "Computing…" : "🧠 Propose a weight retune"}</button>
          {out && <pre style={{ background: "#0f172a", color: "#e2e8f0", padding: 12, borderRadius: 6, fontSize: 12, marginTop: 12, whiteSpace: "pre-wrap" }}>{out}</pre>}
        </>
      )}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div><div className="muted" style={{ fontSize: 11 }}>{label}</div><div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div></div>;
}
const btn: React.CSSProperties = { padding: "8px 14px", border: "1px solid #0f172a", background: "#0f172a", color: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 };
