"use client";
/* Settings & Run — restyled to the design system (kit SettingsScreen). Visual only; all wiring
   (/api/automation, /api/config, /api/refresh, /api/rescore, /api/actions) preserved. */
import { useEffect, useState } from "react";

interface Config { weekly_mail_budget: number; lifetime_mail_cap: number; cooldown_days: number; outreach_enabled: boolean }
interface Auto { autoEnabled: boolean; lastRefreshAgeDays: number | null; isDue: boolean }

export default function SettingsPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [out, setOut] = useState<{ key: string; text: string } | null>(null);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [auto, setAuto] = useState<Auto | null>(null);

  const loadAuto = () => fetch("/api/automation").then((r) => r.json()).then(setAuto);
  useEffect(() => { fetch("/api/config").then((r) => r.json()).then(setCfg); loadAuto(); }, []);

  async function toggleAuto(enabled: boolean) {
    setAuto((a) => (a ? { ...a, autoEnabled: enabled } : a)); // optimistic
    await fetch("/api/automation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "toggle", enabled }) });
    loadAuto();
  }

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
      <div className="screen-head"><h1>Settings &amp; Run</h1><span className="sub">everything that used to be a terminal command — now a button.</span></div>

      {auto && (
        <Section title="Automatic updates">
          <div className="card" style={{ width: "100%", maxWidth: 480, borderColor: auto.autoEnabled ? "var(--positive)" : "var(--border-soft)", background: auto.autoEnabled ? "var(--positive-wash)" : "var(--bg-panel)" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", color: "var(--text-primary)" }}>
              <input type="checkbox" checked={auto.autoEnabled} onChange={(e) => toggleAuto(e.target.checked)} />
              Keep my data fresh automatically
            </label>
            <p className="muted" style={{ fontSize: 12, margin: "6px 0 0", lineHeight: 1.5 }}>
              {auto.autoEnabled
                ? "On — whenever you open LOT and the data is more than a week old, it updates itself in the background. You never have to remember anything."
                : "Off — your data will only update when you click “Update everything” below."}
              {" "}Last updated: <b>{auto.lastRefreshAgeDays == null ? "never" : auto.lastRefreshAgeDays < 1 ? "today" : `${Math.round(auto.lastRefreshAgeDays)} day(s) ago`}</b>
              {auto.isDue && auto.autoEnabled ? " — an update is due and will run on your next visit." : ""}
            </p>
            <p className="muted" style={{ fontSize: 11, margin: "8px 0 0" }}>
              Want it to run even when your laptop is closed? Enable the weekly cloud job (one-time, ~2 min) — see <a href="/dev">Developer</a>.
            </p>
          </div>
        </Section>
      )}

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
          <button onClick={saveCfg} disabled={busy === "cfg"} className="btn-primary" style={{ marginTop: 6 }}>{busy === "cfg" ? "Saving…" : "Save settings"}</button>
        </Section>
      )}

      {out && <pre style={{ background: "var(--bg-chrome)", color: "var(--text-secondary)", padding: 12, borderRadius: "var(--radius-sm)", fontSize: 12, marginTop: 14, whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)", border: "1px solid var(--border-soft)" }}>{out.text}</pre>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 22 }}>
    <h2 style={{ marginBottom: 10 }}>{title}</h2>
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>{children}</div>
  </div>;
}
function Btn({ busy, onClick, children }: { busy: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} disabled={busy} className="btn" style={{ textAlign: "left", width: "100%", maxWidth: 480, justifyContent: "flex-start" }}>{busy ? "Running…" : children}</button>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: 360 }}><span className="muted" style={{ fontSize: 13 }}>{label}</span>{children}</div>;
}
const inp: React.CSSProperties = { width: 90, padding: "6px 8px", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", fontSize: 13, background: "var(--bg-panel)", color: "var(--text-primary)" };
