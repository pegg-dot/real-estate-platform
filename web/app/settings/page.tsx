"use client";
/* Settings & Run — restyled to the design system. The "Run commands" section is gated behind a
   passcode the operator sets (spec 027): set/unlock → buttons → /api/run (verified server-side). */
import { useEffect, useState } from "react";

interface Config { weekly_mail_budget: number; lifetime_mail_cap: number; cooldown_days: number; outreach_enabled: boolean }
interface Auto { autoEnabled: boolean; lastRefreshAgeDays: number | null; isDue: boolean }

const COMMANDS: Array<{ key: string; label: string }> = [
  { key: "refresh", label: "↻ Update everything (county data + distress + re-score)" },
  { key: "rescore", label: "🔁 Re-score the map (to the active thesis)" },
  { key: "enrich", label: "👤 Enrich the top 25 leads (situation + skip-trace)" },
  { key: "leads", label: "📇 Re-generate the lead list" },
  { key: "radar", label: "🏛️ Run the regulatory radar" },
  { key: "growth", label: "🌱 Land-banking buy-ahead shortlist" },
  { key: "portfolio", label: "📊 Best next-buy recommendation" },
];

export default function SettingsPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [out, setOut] = useState<{ key: string; text: string } | null>(null);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [auto, setAuto] = useState<Auto | null>(null);

  // passcode-gated runner state
  const [pcSet, setPcSet] = useState<boolean | null>(null);   // is a passcode configured?
  const [unlocked, setUnlocked] = useState(false);
  const [pc, setPc] = useState("");                            // the entered passcode (this session)
  const [pcInput, setPcInput] = useState("");
  const [pcErr, setPcErr] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  const loadAuto = () => fetch("/api/automation").then((r) => r.json()).then(setAuto);
  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then(setCfg);
    loadAuto();
    fetch("/api/passcode").then((r) => r.json()).then((j) => setPcSet(!!j.set));
    const saved = sessionStorage.getItem("lot_run_pc");
    if (saved) { setPc(saved); setUnlocked(true); }
  }, []);

  async function toggleAuto(enabled: boolean) {
    setAuto((a) => (a ? { ...a, autoEnabled: enabled } : a));
    await fetch("/api/automation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "toggle", enabled }) });
    loadAuto();
  }
  async function saveCfg() {
    if (!cfg) return;
    setBusy("cfg"); setOut(null);
    const r = await fetch("/api/config", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cfg) }).then((x) => x.json());
    setBusy(null); setOut({ key: "cfg", text: r.ok ? "✓ saved" : "⚠️ failed" });
  }

  // ── passcode actions ──
  async function setPasscode(newPc: string, current?: string) {
    setPcErr(null);
    const r = await fetch("/api/passcode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "set", passcode: newPc, current }) }).then((x) => x.json());
    if (!r.ok) { setPcErr(r.error ?? "failed"); return false; }
    setPcSet(true); setUnlocked(true); setPc(newPc); sessionStorage.setItem("lot_run_pc", newPc); setPcInput(""); setChanging(false);
    return true;
  }
  async function unlock(code: string) {
    setPcErr(null);
    const r = await fetch("/api/passcode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "verify", passcode: code }) }).then((x) => x.json());
    if (!r.ok) { setPcErr("Wrong passcode."); return; }
    setUnlocked(true); setPc(code); sessionStorage.setItem("lot_run_pc", code); setPcInput("");
  }
  function lock() { setUnlocked(false); setPc(""); sessionStorage.removeItem("lot_run_pc"); }

  async function runCmd(key: string) {
    setBusy(key); setOut(null);
    const r = await fetch("/api/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ passcode: pc, command: key }) }).then((x) => x.json());
    setBusy(null);
    if (r.error === "wrong passcode") { lock(); setPcErr("Session expired — re-enter your passcode."); return; }
    setOut({ key, text: r.ok ? (r.output || "✓ done") : `⚠️ ${r.error}` });
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
                ? "On — whenever you open LOT and the data is more than a week old, it updates itself in the background."
                : "Off — your data only updates when you run “Update everything” below."}
              {" "}Last updated: <b>{auto.lastRefreshAgeDays == null ? "never" : auto.lastRefreshAgeDays < 1 ? "today" : `${Math.round(auto.lastRefreshAgeDays)} day(s) ago`}</b>
              {auto.isDue && auto.autoEnabled ? " — an update is due and will run on your next visit." : ""}
            </p>
          </div>
        </Section>
      )}

      <Section title="🔒 Run commands (passcode-protected)">
        {pcSet === null && <p className="muted" style={{ fontSize: 13 }}>Loading…</p>}

        {pcSet === false && !unlocked && (
          <div className="card" style={{ maxWidth: 480 }}>
            <p style={{ fontSize: 13, marginBottom: 8 }}>Set a passcode to enable the run buttons. You&apos;ll enter it to run any command.</p>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="password" value={pcInput} onChange={(e) => setPcInput(e.target.value)} placeholder="new passcode (4+ chars)" style={inp} />
              <button className="btn-primary" onClick={() => setPasscode(pcInput)} disabled={pcInput.length < 4}>Set passcode</button>
            </div>
            {pcErr && <p style={{ color: "var(--critical)", fontSize: 12, marginTop: 6 }}>{pcErr}</p>}
          </div>
        )}

        {pcSet === true && !unlocked && (
          <div className="card" style={{ maxWidth: 480 }}>
            <p style={{ fontSize: 13, marginBottom: 8 }}>Enter your passcode to unlock the run commands.</p>
            <form onSubmit={(e) => { e.preventDefault(); unlock(pcInput); }} style={{ display: "flex", gap: 6 }}>
              <input type="password" value={pcInput} onChange={(e) => setPcInput(e.target.value)} placeholder="passcode" style={inp} autoFocus />
              <button type="submit" className="btn-primary">Unlock</button>
            </form>
            {pcErr && <p style={{ color: "var(--critical)", fontSize: 12, marginTop: 6 }}>{pcErr}</p>}
          </div>
        )}

        {unlocked && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
              {COMMANDS.map((c) => (
                <button key={c.key} onClick={() => runCmd(c.key)} disabled={!!busy} className="btn" style={{ textAlign: "left", width: "100%", maxWidth: 480, justifyContent: "flex-start" }}>
                  {busy === c.key ? "Running…" : c.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button className="btn-ghost btn-sm" onClick={() => setChanging((v) => !v)}>Change passcode</button>
              <button className="btn-ghost btn-sm" onClick={lock}>Lock</button>
            </div>
            {changing && (
              <div className="card" style={{ maxWidth: 480, marginTop: 8 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <input type="password" value={pcInput} onChange={(e) => setPcInput(e.target.value)} placeholder="new passcode (4+ chars)" style={inp} />
                  <button className="btn-primary" onClick={() => setPasscode(pcInput, pc)} disabled={pcInput.length < 4}>Save</button>
                </div>
                {pcErr && <p style={{ color: "var(--critical)", fontSize: 12, marginTop: 6 }}>{pcErr}</p>}
              </div>
            )}
          </>
        )}
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
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: 360 }}><span className="muted" style={{ fontSize: 13 }}>{label}</span>{children}</div>;
}
const inp: React.CSSProperties = { width: 220, padding: "6px 8px", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", fontSize: 13, background: "var(--bg-panel)", color: "var(--text-primary)" };
