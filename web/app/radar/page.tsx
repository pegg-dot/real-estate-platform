"use client";
import { useEffect, useState } from "react";

interface Evt { zone_code: string; change_type: string; direction: string | null; affected_parcel_count: number; alpha_note: string | null; created_at: string }
interface Rule { zone_code: string; by_room_legal: boolean; max_unrelated_occupants: number | null; stability_flag: string | null }
const DIR: Record<string, string> = { opportunity: "🟢", risk: "🔴", neutral: "⚪️" };

export default function RadarPage() {
  const [data, setData] = useState<{ events: Evt[]; rules: Rule[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => fetch("/api/radar").then((r) => r.json()).then(setData);
  useEffect(() => { load(); }, []);

  async function runRadar() {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "run-radar" }) }).then((x) => x.json());
    setBusy(false); setMsg(r.ok ? r.output : `⚠️ ${r.error}`); if (r.ok) load();
  }

  if (!data) return <div className="page"><p className="muted">Loading…</p></div>;
  return (
    <div className="page">
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Regulatory radar — zoning as alpha</h1>
      <p className="muted" style={{ marginBottom: 10 }}>A zoning change legalizes/revokes by-room renting → an opportunity or risk, with the affected-parcel count. Golden-rule #3.</p>
      <button onClick={runRadar} disabled={busy} style={btn}>{busy ? "Running…" : "↻ Run radar (detect changes)"}</button>
      {msg && <pre style={{ background: "var(--bg-chrome)", color: "var(--text-secondary)", padding: 10, borderRadius: 6, fontSize: 12, marginTop: 10, whiteSpace: "pre-wrap" }}>{msg}</pre>}

      <h2 style={{ fontSize: 14, marginTop: 20, marginBottom: 8 }}>Events ({data.events.length})</h2>
      {data.events.length === 0 ? <p className="muted">No regulatory changes detected. Edit a zone in config/zoning and Run radar to simulate one.</p> : (
        <table><thead><tr><th></th><th>Zone</th><th>Change</th><th>Parcels</th><th>Alpha</th></tr></thead><tbody>
          {data.events.map((e, i) => (<tr key={i}><td>{DIR[e.direction ?? "neutral"]}</td><td><strong>{e.zone_code}</strong></td><td>{e.change_type.replace(/_/g, " ")}</td><td>{e.affected_parcel_count.toLocaleString()}</td><td className="muted">{e.alpha_note}</td></tr>))}
        </tbody></table>
      )}

      <h2 style={{ fontSize: 14, marginTop: 20, marginBottom: 8 }}>Current zoning rules</h2>
      <table><thead><tr><th>Zone</th><th>By-room legal</th><th>Max unrelated</th><th>Stability</th></tr></thead><tbody>
        {data.rules.map((r, i) => (<tr key={i}><td><strong>{r.zone_code}</strong></td><td>{r.by_room_legal ? "✓ yes" : "no"}</td><td>{r.max_unrelated_occupants ?? "—"}</td><td className="muted" style={{ maxWidth: 360, fontSize: 11 }}>{(r.stability_flag ?? "").slice(0, 80)}</td></tr>))}
      </tbody></table>
    </div>
  );
}
const btn: React.CSSProperties = { padding: "7px 14px", border: "1px solid var(--accent)", background: "var(--accent)", color: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 };
