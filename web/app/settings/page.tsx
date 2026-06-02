"use client";
import { useEffect, useState } from "react";

interface Config { weekly_mail_budget: number; lifetime_mail_cap: number; cooldown_days: number; outreach_enabled: boolean }

export default function SettingsPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [out, setOut] = useState<{ key: string; text: string } | null>(null);
  const [cfg, setCfg] = useState<Config | null>(null);

  useEffect(() => { fetch("/api/config").then((r) => r.json()).then(setCfg); }, []);

  async function run(key: string, url: string, action?: Record<string, unknown>) {
    setBusy(key); setOut(null);
    const r = action
      ? await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(action) }).then((x) => x.json())
      : await fetch(url, { method: "POST" }).then((x) => x.json());
    setBusy(null);
    setOut({ key, text: r.ok === false ? `⚠️ ${r.error}` : (r.message || r.output || "✓ done") });
  }
  async function saveCfg() {
    if (!cfg) return;
    setBusy("cfg"); setOut(null);
    const r = await fetch("/api/config", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cfg) }).then((x) => x.json());
    setBusy(null); setOut({ key: "cfg", text: r.ok ? "✓ saved" : "⚠️ failed" });
  }

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Settings &amp; Run</h1>
      <p className="muted" style={{ marginBottom: 18 }}>Everything that used to be a terminal command — now a button. (For the recurring update, enable the weekly GitHub Action; this is for on-demand.)</p>

      <Section title="Keep the data fresh">
        <Btn busy={busy === "refresh"} onClick={() => run("refresh", "/api/refresh")}>↻ Update everything (county data + distress + re-score)</Btn>
        <Btn busy={busy === "rescore"} onClick={() => run("rescore", "/api/rescore")}>🔁 Re-score the map (to the active thesis)</Btn>
        <Btn busy={busy === "enrich"} onClick={() => run("enrich", "", { action: "enrich-leads", n: 25 })}>👤 Enrich the top 25 leads (situation + skip-trace)</Btn>
        <Btn busy={busy === "leads"} onClick={() => run("leads", "", { action: "generate-leads" })}>📇 Re-generate the lead list</Btn>
        <Btn busy={busy === "radar"} onClick={() => run("radar", "", { action: "run-radar" })}>🏛️ Run the regulatory radar</Btn>
      </Section>

      {cfg && (
        <Section title="Outreach settings">
          <Row label="Letters per week"><input type="number" value={cfg.weekly_mail_budget} onChange={(e) => setCfg({ ...cfg, weekly_mail_budget: Number(e.target.value) })} style={inp} /></Row>
          <Row label="Lifetime contacts per owner"><input type="number" value={cfg.lifetime_mail_cap} onChange={(e) => setCfg({ ...cfg, lifetime_mail_cap: Number(e.target.value) })} style={inp} /></Row>
          <Row label="Cooldown between letters (days)"><input type="number" value={cfg.cooldown_days} onChange={(e) => setCfg({ ...cfg, cooldown_days: Number(e.target.value) })} style={inp} /></Row>
          <Row label="Outreach enabled (kill-switch)"><input type="checkbox" checked={cfg.outreach_enabled} onChange={(e) => setCfg({ ...cfg, outreach_enabled: e.target.checked })} /></Row>
          <button onClick={saveCfg} disabled={busy === "cfg"} style={primary}>{busy === "cfg" ? "Saving…" : "Save settings"}</button>
        </Section>
      )}

      {out && <pre style={{ background: "#0f172a", color: "#e2e8f0", padding: 12, borderRadius: 6, fontSize: 12, marginTop: 14, whiteSpace: "pre-wrap" }}>{out.text}</pre>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 22 }}>
    <h2 style={{ fontSize: 14, marginBottom: 10 }}>{title}</h2>
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>{children}</div>
  </div>;
}
function Btn({ busy, onClick, children }: { busy: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} disabled={busy} style={{ padding: "9px 14px", border: "1px solid #cbd5e1", background: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, textAlign: "left", width: "100%", maxWidth: 480 }}>{busy ? "Running…" : children}</button>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: 360 }}><span className="muted" style={{ fontSize: 13 }}>{label}</span>{children}</div>;
}
const inp: React.CSSProperties = { width: 80, padding: "5px 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 };
const primary: React.CSSProperties = { padding: "8px 16px", border: "none", background: "#0f172a", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, marginTop: 6 };
