"use client";
import { Suspense, useState } from "react";
import Icon from "../components/Icon";
import AsyncState from "../components/AsyncState";
import { useResource } from "../lib/useResource";
import Connectors from "./Connectors";

interface Config { weekly_mail_budget: number; lifetime_mail_cap: number; cooldown_days: number; outreach_enabled: boolean }
interface Auto { autoEnabled: boolean; lastRefreshAgeDays: number | null; isDue: boolean }
const COMMANDS = [
  { key: "refresh", title: "Refresh market data", detail: "Collect county data, refresh distress signals, and re-score properties.", icon: "refresh" },
  { key: "rescore", title: "Re-score properties", detail: "Apply your active investment thesis to the current data.", icon: "target" },
  { key: "enrich", title: "Research top leads", detail: "Enrich the top 25 leads using configured data providers.", icon: "user" },
  { key: "leads", title: "Generate leads", detail: "Rebuild the ranked lead list from current property signals.", icon: "leads" },
  { key: "radar", title: "Check regulatory changes", detail: "Run the regulatory radar for this market.", icon: "radar" },
  { key: "growth", title: "Review growth corridors", detail: "Refresh the land-banking and buy-ahead shortlist.", icon: "changes" },
  { key: "portfolio", title: "Review portfolio sequence", detail: "Calculate the next-buy recommendation against your holdings.", icon: "building" },
];
async function post(url: string, body: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error === "wrong passcode" ? "wrong passcode" : "Request not confirmed. Check the activity log and try again.");
  return result;
}
export default function SettingsPage() {
  const config = useResource<Config>("/api/config");
  const automation = useResource<Auto>("/api/automation");
  const passcode = useResource<{ set: boolean }>("/api/passcode");
  const [draft, setDraft] = useState<Config | null>(null);
  const cfg = draft ?? config.data;
  const [busy, setBusy] = useState<string | null>(null);
  const [out, setOut] = useState<{ key: string; text: string; error?: boolean } | null>(null);
  const [pc, setPc] = useState("");
  const [pcInput, setPcInput] = useState("");
  const [pcErr, setPcErr] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [hasPasscode, setHasPasscode] = useState<boolean | null>(null);
  const pcSet = hasPasscode ?? passcode.data?.set;
  const unlocked = pc.length > 0;
  // Runner credentials live only in component memory, never in browser storage or the URL.
  async function authenticate(set: boolean) {
    if (busy || !pcInput) return;
    setBusy("auth"); setPcErr(null);
    try {
      await post("/api/passcode", { action: set ? "set" : "verify", passcode: pcInput, ...(set && pc ? { current: pc } : {}) });
      setPc(pcInput); setPcInput(""); setHasPasscode(true); setChanging(false);
    } catch { setPcErr("The passcode could not be verified or saved. Check your entry and connection, then retry."); }
    finally { setBusy(null); }
  }
  async function run(key: string) {
    if (busy) return;
    setBusy(key); setOut(null);
    try { const result = await post("/api/run", { command: key, passcode: pc }); setOut({ key, text: result.output || "Command completed." }); automation.reload(); }
    catch (error) { if ((error as Error).message === "wrong passcode") { setPc(""); setPcErr("Runner authorization expired. Enter your passcode again."); } setOut({ key, error: true, text: "The command result was not confirmed. Check Activity and the server logs before retrying a long-running command." }); }
    finally { setBusy(null); }
  }
  async function toggleAutomation(enabled: boolean) {
    if (busy) return;
    setBusy("auto"); setOut(null);
    try { await post("/api/automation", { action: "toggle", enabled }); automation.reload(); }
    catch { setOut({ key: "auto", error: true, text: "The automatic refresh setting was not saved. Please retry." }); }
    finally { setBusy(null); }
  }
  async function saveConfig(event: React.FormEvent) {
    event.preventDefault(); if (!cfg || busy) return;
    setBusy("config"); setOut(null);
    try { const result = await post("/api/config", cfg); setDraft(result); setOut({ key: "config", text: "Outreach limits saved." }); }
    catch { setOut({ key: "config", error: true, text: "Outreach limits were not confirmed as saved. Please retry." }); }
    finally { setBusy(null); }
  }
  const authenticationForm = <form className="runner-auth" onSubmit={event => { event.preventDefault(); authenticate(pcSet === false || changing); }}><label><span>{pcSet === false || changing ? "New runner passcode" : "Runner passcode"}</span><input type="password" autoComplete={pcSet === false || changing ? "new-password" : "current-password"} value={pcInput} onChange={event => setPcInput(event.target.value)} minLength={pcSet === false || changing ? 4 : 1} required aria-describedby="runner-auth-note" /></label><button className="btn-primary" disabled={!!busy || !pcInput || ((pcSet === false || changing) && pcInput.length < 4)}>{busy === "auth" ? "Verifying..." : pcSet === false ? "Set passcode" : changing ? "Save passcode" : "Unlock controls"}</button></form>;
  return <div className="page settings-page">
    <div className="page-heading"><div><div className="page-eyebrow">Workspace settings</div><h1>Your data. Your controls.</h1><p>Set up your market, manage optional connections, and keep operational actions deliberate.</p></div><a href="https://github.com/pegg-dot/real-estate-platform/blob/main/docs/SELF_HOSTING.md" target="_blank" rel="noreferrer" className="btn">Self-hosting guide<Icon name="external" size={13} /></a></div>
    <div className="settings-layout"><nav className="settings-nav" aria-label="Settings sections"><a href="#setup">First-run setup</a><a href="#refresh">Data refresh</a><a href="#runner">Run controls</a><a href="#outreach">Outreach limits</a><a href="#connections">Connected accounts</a></nav><div className="settings-sections">
      <section id="setup" className="settings-section"><div className="settings-section-title"><Icon name="database" size={18} /><div><h2>First-run setup</h2><p>A useful property list does not require an AI key or a map token.</p></div></div><div className="setup-guide"><div><span className="step-index">01</span><div><h3>Load a sample of your market</h3><p>From the repository folder, with Docker running:</p><pre><code>docker compose run --rm app lot refresh -- --market Charlottesville --distress --no-history --limit 500</code></pre><p>This downloads public records and writes them to your local database. The first run can take a few minutes.</p></div></div><div><span className="step-index">02</span><div><h3>Add the capabilities you need</h3><p>Set <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in .env for the map. Set <code>ANTHROPIC_API_KEY</code> for chat and AI-assisted research. Then run <code>docker compose up -d</code> to recreate the app with the updated environment.</p></div></div><div><span className="step-index">03</span><div><h3>Keep a local workspace private</h3><p>The default instance binds to localhost and has no login. Configure authentication and HTTPS before public exposure. Do not put private keys in chat, source code, or public issues.</p></div></div></div></section>
      <section id="refresh" className="settings-section"><div className="settings-section-title"><Icon name="refresh" size={18} /><div><h2>Data refresh</h2><p>Choose when LOT may request a new market refresh.</p></div></div>{automation.loading ? <AsyncState loading title="Reading refresh settings" /> : automation.error ? <AsyncState error title="Refresh status unavailable" description={automation.error} retry={automation.reload} /> : automation.data && <div className="settings-setting"><div><strong>Request stale data updates automatically</strong><p>{automation.data.autoEnabled ? "When you visit LOT and the last refresh is more than a week old, it can request a new update." : "Automatic updates are off. Run a refresh explicitly below."}</p><small>Last refresh started: {automation.data.lastRefreshAgeDays == null ? "not recorded" : automation.data.lastRefreshAgeDays < 1 ? "today" : `${Math.floor(automation.data.lastRefreshAgeDays)} days ago`}. A start time does not confirm completion.</small></div><label className="toggle-control"><input type="checkbox" checked={automation.data.autoEnabled} disabled={!!busy} onChange={event => toggleAutomation(event.target.checked)} aria-label="Automatic data updates" /><span aria-hidden="true" /></label></div>}{out?.key === "auto" && <Feedback result={out} />}</section>
      <section id="runner" className="settings-section"><div className="settings-section-title"><Icon name="shield" size={18} /><div><h2>Run controls</h2><p>Maintenance commands are authorized on the server with your runner passcode.</p></div>{unlocked && <span className="pill">Unlocked for this visit</span>}</div>{passcode.loading ? <AsyncState loading title="Checking runner authorization" /> : passcode.error ? <AsyncState error title="Runner status unavailable" description={passcode.error} retry={passcode.reload} /> : <>{!unlocked && <div className="runner-lock"><p id="runner-auth-note">{pcSet === false ? "Create a passcode of at least four characters to enable these controls." : "Enter your passcode to enable maintenance actions. This is separate from workspace sign-in."}</p>{authenticationForm}</div>}{unlocked && <><div className="command-grid">{COMMANDS.map(command => <button className="maintenance-command" key={command.key} disabled={!!busy} onClick={() => run(command.key)}><Icon name={busy === command.key ? "refresh" : command.icon} className={busy === command.key ? "is-spinning" : ""} size={17} /><span><strong>{busy === command.key ? "Running..." : command.title}</strong><small>{command.detail}</small></span><Icon name="right" size={13} /></button>)}</div><div className="runner-footer"><button className="btn-ghost btn-sm" disabled={!!busy} onClick={() => { setPc(""); setPcInput(""); setChanging(false); }}>Lock controls</button><button className="btn-ghost btn-sm" disabled={!!busy} onClick={() => setChanging(!changing)}>{changing ? "Cancel passcode change" : "Change passcode"}</button></div>{changing && <div className="runner-lock"><p id="runner-auth-note">Set a replacement passcode using your current authorization.</p>{authenticationForm}</div>}</>}{pcErr && <p className="settings-error" role="alert">{pcErr}</p>}</>}{out && COMMANDS.some(command => command.key === out.key) && <Feedback result={out} />}</section>
      <section id="outreach" className="settings-section"><div className="settings-section-title"><Icon name="mail" size={18} /><div><h2>Outreach limits</h2><p>Set the cadence and use the kill switch to stop new outreach.</p></div></div>{config.loading ? <AsyncState loading title="Loading outreach limits" /> : config.error ? <AsyncState error title="Outreach settings unavailable" description={config.error} retry={config.reload} /> : cfg && <form onSubmit={saveConfig}><label className="settings-form-row"><span>Letters per week<small>Maximum configured weekly budget</small></span><input type="number" min={1} max={500} step={1} required value={cfg.weekly_mail_budget} onChange={event => setDraft({ ...cfg, weekly_mail_budget: Number(event.target.value) })} /></label><label className="settings-form-row"><span>Lifetime contacts per owner<small>Cap repeated contact with the same owner</small></span><input type="number" min={1} max={20} step={1} required value={cfg.lifetime_mail_cap} onChange={event => setDraft({ ...cfg, lifetime_mail_cap: Number(event.target.value) })} /></label><label className="settings-form-row"><span>Days between letters<small>Minimum cooldown for follow-up outreach</small></span><input type="number" min={1} max={365} step={1} required value={cfg.cooldown_days} onChange={event => setDraft({ ...cfg, cooldown_days: Number(event.target.value) })} /></label><label className="settings-form-row"><span>Outreach enabled<small>Turn off and save to engage the kill switch</small></span><input type="checkbox" checked={cfg.outreach_enabled} onChange={event => setDraft({ ...cfg, outreach_enabled: event.target.checked })} /></label><button className="btn-primary" disabled={!!busy}>{busy === "config" ? "Saving..." : "Save outreach limits"}</button></form>}{out?.key === "config" && <Feedback result={out} />}</section>
      <section id="connections" className="settings-section"><div className="settings-section-title"><Icon name="external" size={18} /><div><h2>Connected accounts</h2><p>Connect tools you use. Every external send or calendar action still needs approval.</p></div></div><Suspense fallback={<AsyncState loading title="Checking connected accounts" />}><Connectors /></Suspense></section>
    </div></div>
  </div>;
}
function Feedback({ result }: { result: { text: string; error?: boolean } }) { return <div className={`operation-result${result.error ? " is-error" : ""}`} role={result.error ? "alert" : "status"}><Icon name={result.error ? "warning" : "check"} size={15} /><pre>{result.text}</pre></div>; }
