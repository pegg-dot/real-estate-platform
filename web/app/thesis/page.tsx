"use client";
import { useEffect, useState } from "react";

interface ThesisRow { version: number; mode: string | null; primary: string | null; is_active: boolean }

export default function ThesisPage() {
  const [prose, setProse] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [out, setOut] = useState<string | null>(null);
  const [theses, setTheses] = useState<ThesisRow[]>([]);

  const loadTheses = () => fetch("/api/theses").then((r) => r.json()).then((j) => setTheses(j.theses ?? []));
  useEffect(() => { loadTheses(); }, []);

  async function setThesis() {
    if (!prose.trim()) return;
    setBusy("set"); setOut(null);
    const r = await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "thesis-from", prose }) }).then((x) => x.json());
    setBusy(null);
    setOut(r.ok ? r.output : `⚠️ ${r.error}`);
    if (r.ok) loadTheses();
  }
  async function rescore() {
    setBusy("rescore"); setOut(null);
    const r = await fetch("/api/rescore", { method: "POST" }).then((x) => x.json());
    setBusy(null); setOut(r.message ?? "started");
  }

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Thesis — describe what you want, in plain English</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        Type your buying thesis. Claude extracts a structured thesis, saves + activates it; re-score to
        re-rank the whole map to it. (Needs Anthropic credits — it’ll tell you if the account is empty.)
      </p>

      <textarea value={prose} onChange={(e) => setProse(e.target.value)} rows={4}
        placeholder='e.g. "All-cash by-the-room student rentals within half a mile of UVA, prioritize cash flow over appreciation, avoid flood zones, open to seller financing for tired long-tenure landlords."'
        style={{ width: "100%", padding: 10, border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button onClick={setThesis} disabled={busy === "set"} style={btn}>{busy === "set" ? "Reading…" : "Set thesis from description"}</button>
        <button onClick={rescore} disabled={busy === "rescore"} style={{ ...btn, background: "#fff", color: "#0f172a" }}>{busy === "rescore" ? "Starting…" : "Re-score the map to it"}</button>
      </div>

      {out && <pre style={{ background: "#0f172a", color: "#e2e8f0", padding: 12, borderRadius: 6, fontSize: 12, overflowX: "auto", marginTop: 14, whiteSpace: "pre-wrap" }}>{out}</pre>}

      <h2 style={{ fontSize: 14, marginTop: 24, marginBottom: 8 }}>Thesis versions</h2>
      <table>
        <thead><tr><th>v</th><th>mode</th><th>primary</th><th></th></tr></thead>
        <tbody>
          {theses.map((t) => (
            <tr key={t.version}>
              <td><strong>v{t.version}</strong></td>
              <td className="muted">{t.mode ?? "—"}</td>
              <td className="muted">{t.primary ?? "—"}</td>
              <td>{t.is_active ? <span className="pill ok">active</span> : ""}</td>
            </tr>
          ))}
          {theses.length === 0 && <tr><td colSpan={4} className="muted">No theses yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

const btn: React.CSSProperties = { padding: "8px 14px", border: "1px solid #0f172a", background: "#0f172a", color: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 };
