"use client";
import { useEffect, useState } from "react";

interface ThesisRow { version: number; mode: string | null; primary: string | null; is_active: boolean }
interface RankRow { rnk: number; score: number; apn: string | null; address: string | null }
interface Mover { apn: string | null; address: string | null; rnkA: number | null; rnkB: number | null }
interface Compare {
  a: number; b: number; metaA: ThesisRow | null; metaB: ThesisRow | null;
  topA: RankRow[]; topB: RankRow[]; overlap25: number; changed25: number;
  entered: Mover[]; dropped: Mover[]; error?: string;
}

export default function ThesisPage() {
  const [prose, setProse] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [out, setOut] = useState<string | null>(null);
  const [theses, setTheses] = useState<ThesisRow[]>([]);
  const [cmpA, setCmpA] = useState<number | null>(null);
  const [cmpB, setCmpB] = useState<number | null>(null);
  const [cmp, setCmp] = useState<Compare | null>(null);
  const [cmpBusy, setCmpBusy] = useState(false);

  const loadTheses = () => fetch("/api/theses").then((r) => r.json()).then((j) => {
    const t: ThesisRow[] = j.theses ?? [];
    setTheses(t);
    setCmpA((prev) => prev ?? (t[0]?.version ?? null));
    setCmpB((prev) => prev ?? (t[1]?.version ?? null));
  });
  useEffect(() => { loadTheses(); }, []);

  async function compare() {
    if (cmpA == null || cmpB == null) return;
    setCmpBusy(true); setCmp(null);
    const r = await fetch(`/api/compare?a=${cmpA}&b=${cmpB}`).then((x) => x.json());
    setCmpBusy(false); setCmp(r);
  }

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
  async function activate(version: number) {
    setBusy(`act${version}`); setOut(null);
    const r = await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "thesis-activate", version }) }).then((x) => x.json());
    setBusy(null); setOut(r.ok ? `${r.output}\n(Re-score to apply it to the map.)` : `⚠️ ${r.error}`); if (r.ok) loadTheses();
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
              <td>{t.is_active ? <span className="pill ok">active</span> :
                <button onClick={() => activate(t.version)} disabled={busy === `act${t.version}`} style={{ padding: "3px 10px", border: "1px solid #cbd5e1", borderRadius: 5, background: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>{busy === `act${t.version}` ? "…" : "Activate"}</button>}</td>
            </tr>
          ))}
          {theses.length === 0 && <tr><td colSpan={4} className="muted">No theses yet.</td></tr>}
        </tbody>
      </table>

      {theses.length >= 2 && (
        <>
          <h2 style={{ fontSize: 14, marginTop: 28, marginBottom: 6 }}>Compare two versions (A/B)</h2>
          <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            See how changing your thesis re-ranks your parcels — without re-scoring. Which deals rise into your shortlist, which fall off.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
            <Picker label="A" value={cmpA} onChange={setCmpA} theses={theses} />
            <span className="muted">vs</span>
            <Picker label="B" value={cmpB} onChange={setCmpB} theses={theses} />
            <button onClick={compare} disabled={cmpBusy || cmpA === cmpB} style={btn}>{cmpBusy ? "Comparing…" : "Compare"}</button>
            {cmpA === cmpB && <span className="muted" style={{ fontSize: 12 }}>pick two different versions</span>}
          </div>

          {cmp?.error && <div style={{ background: "#fef3c7", color: "#92400e", padding: 10, borderRadius: 6, fontSize: 13 }}>⚠️ {cmp.error}</div>}

          {cmp && !cmp.error && (
            <div>
              <div style={{ background: "#f1f5f9", borderRadius: 8, padding: "12px 14px", marginBottom: 14, fontSize: 14 }}>
                <b>{cmp.changed25} of your top 25 parcels changed</b> between v{cmp.a} and v{cmp.b}.{" "}
                <span className="muted">({cmp.overlap25} stayed in the shortlist · {cmp.entered.length} rose in · {cmp.dropped.length} dropped off.)</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <RankList title={`v${cmp.a} top 15`} subtitle={cmp.metaA?.primary} rows={cmp.topA} />
                <RankList title={`v${cmp.b} top 15`} subtitle={cmp.metaB?.primary} rows={cmp.topB} />
              </div>

              {cmp.entered.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h3 style={{ fontSize: 13, marginBottom: 6, color: "#065f46" }}>▲ Rose into your top 25 under v{cmp.b}</h3>
                  {cmp.entered.map((m) => (
                    <div key={m.apn} style={{ fontSize: 12 }} className="muted">
                      #{m.rnkB} <b style={{ color: "#0f172a" }}>{m.address ?? m.apn}</b> {m.rnkA ? `(was #${m.rnkA})` : "(was outside top 50)"}
                    </div>
                  ))}
                </div>
              )}
              {cmp.dropped.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <h3 style={{ fontSize: 13, marginBottom: 6, color: "#991b1b" }}>▼ Fell off your top 25 under v{cmp.b}</h3>
                  {cmp.dropped.map((m) => (
                    <div key={m.apn} style={{ fontSize: 12 }} className="muted">
                      was #{m.rnkA} <b style={{ color: "#0f172a" }}>{m.address ?? m.apn}</b> {m.rnkB ? `(now #${m.rnkB})` : "(now outside top 50)"}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Picker({ label, value, onChange, theses }: { label: string; value: number | null; onChange: (v: number) => void; theses: ThesisRow[] }) {
  return (
    <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
      <span className="muted">{label}</span>
      <select value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))} style={{ padding: "5px 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}>
        {theses.map((t) => <option key={t.version} value={t.version}>v{t.version}{t.is_active ? " (active)" : ""} — {t.primary ?? t.mode ?? "—"}</option>)}
      </select>
    </label>
  );
}
function RankList({ title, subtitle, rows }: { title: string; subtitle?: string | null; rows: RankRow[] }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
      {subtitle && <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>{subtitle}</div>}
      {rows.map((r) => (
        <div key={r.apn} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
          <span><span className="muted">#{r.rnk}</span> {r.address ?? r.apn}</span>
          <span style={{ fontWeight: 600 }}>{Math.round(r.score)}</span>
        </div>
      ))}
    </div>
  );
}

const btn: React.CSSProperties = { padding: "8px 14px", border: "1px solid #0f172a", background: "#0f172a", color: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 };
