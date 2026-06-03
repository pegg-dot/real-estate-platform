/* LOT terminal — Settings: a passcode-protected key vault + run controls.
   Keys are obfuscated in localStorage behind a passcode (browser-local — production
   uses a server secret manager; see INTEGRATION-SPEC.md §0). */
function SettingsScreen() {
  const PKEY = "lot_vault_pin", VKEY = "lot_vault";
  const ls = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch (e) { return null; } };
  const xor = (s, pin) => s.split("").map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ pin.charCodeAt(i % pin.length))).join("");
  const enc = (obj, pin) => btoa(unescape(encodeURIComponent(xor(JSON.stringify(obj), pin))));
  const dec = (str, pin) => { try { return JSON.parse(decodeURIComponent(escape(xor(atob(str), pin)))); } catch (e) { return null; } };

  const fields = [
    { id: "gmaps", label: "Google Maps API key", hint: "Map Tiles + Maps JS — powers the 3D view.", ph: "AIzaSy…", mirror: "lot_gkey" },
    { id: "anthropic", label: "Anthropic API key", hint: "Server-side in production — never shipped to the browser. Stored here only for local prototyping.", ph: "sk-ant-…" },
    { id: "rentcast", label: "RentCast key", hint: "Real rent comps that override the modeled $/bed.", ph: "rc_…" },
    { id: "skiptrace", label: "Skip-trace vendor key", hint: "Owner contact enrichment. Not a consumer report.", ph: "…" },
  ];

  const hasPin = !!ls(PKEY);
  const [stage, setStage] = React.useState(hasPin ? "locked" : "setup");
  const [pin, setPin] = React.useState("");
  const [pin2, setPin2] = React.useState("");
  const [err, setErr] = React.useState("");
  const [vals, setVals] = React.useState({});
  const [show, setShow] = React.useState({});
  const [saved, setSaved] = React.useState(false);
  const [gmail, setGmail] = React.useState(ls("lot_gmail_connected") === "1");

  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); };

  function createPin() {
    if (pin.length < 4) return setErr("Use at least 4 characters.");
    if (pin !== pin2) return setErr("Passcodes don't match.");
    ls(PKEY, hash(pin)); ls(VKEY, enc({}, pin)); setErr(""); setStage("unlocked"); setVals({});
  }
  function unlock() {
    if (ls(PKEY) !== hash(pin)) return setErr("Wrong passcode.");
    const v = dec(ls(VKEY) || "", pin) || {}; setVals(v); setErr(""); setStage("unlocked");
  }
  function save() {
    ls(VKEY, enc(vals, pin));
    if (vals.gmaps) ls("lot_gkey", vals.gmaps); else ls("lot_gkey", "");
    setSaved(true); setTimeout(() => setSaved(false), 1800);
  }
  function lock() { setPin(""); setVals({}); setShow({}); setStage(ls(PKEY) ? "locked" : "setup"); }
  function reset() { try { localStorage.removeItem(PKEY); localStorage.removeItem(VKEY); } catch (e) {} setPin(""); setPin2(""); setVals({}); setStage("setup"); setErr(""); }

  // ---- locked / setup gate ----
  if (stage !== "unlocked") {
    const setup = stage === "setup";
    return (
      <div className="reading" style={{ maxWidth: 460 }}>
        <div className="screen-head"><h1>Settings</h1></div>
        <div className="card" style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12, alignItems: "center", textAlign: "center", padding: "26px 22px" }}>
          <i className="ti ti-lock" style={{ fontSize: 30, color: "var(--accent-bright)" }} />
          <div style={{ font: "var(--text-h2)" }}>{setup ? "Create a vault passcode" : "Vault locked"}</div>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", maxWidth: 320, lineHeight: 1.55 }}>
            {setup
              ? "Your API keys live behind this passcode, obfuscated in this browser. Pick something you'll remember — there's no recovery."
              : "Enter your passcode to view and edit your saved API keys."}
          </p>
          <div className="search" style={{ width: 280 }}>
            <i className="ti ti-key" />
            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="passcode"
              onKeyDown={(e) => e.key === "Enter" && (setup ? createPin() : unlock())} />
          </div>
          {setup && (
            <div className="search" style={{ width: 280 }}>
              <i className="ti ti-key" />
              <input type="password" value={pin2} onChange={(e) => setPin2(e.target.value)} placeholder="confirm passcode"
                onKeyDown={(e) => e.key === "Enter" && createPin()} />
            </div>
          )}
          {err && <div style={{ color: "var(--critical)", fontSize: 12 }}>{err}</div>}
          <button className="btn-primary" style={{ width: 280, justifyContent: "center" }} onClick={setup ? createPin : unlock}>
            <i className="ti ti-lock-open" /> {setup ? "Create vault" : "Unlock"}
          </button>
          {!setup && <button className="btn-ghost btn-sm" onClick={reset}>Forgot it? Reset vault (clears keys)</button>}
          <div className="disclaimer">Browser-local obfuscation — not a substitute for a server secret manager.</div>
        </div>
      </div>
    );
  }

  // ---- unlocked vault ----
  return (
    <div className="reading" style={{ maxWidth: 620 }}>
      <div className="screen-head">
        <h1>Settings</h1>
        <span className="sub">Key vault · unlocked</span>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3><i className="ti ti-key" /> API keys &amp; secrets</h3>
        {fields.map((f) => (
          <div key={f.id} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>{f.label}</div>
            <div className="search" style={{ height: 34 }}>
              <i className="ti ti-key" style={{ fontSize: 14 }} />
              <input type={show[f.id] ? "text" : "password"} value={vals[f.id] || ""} placeholder={f.ph}
                onChange={(e) => setVals((v) => ({ ...v, [f.id]: e.target.value }))} />
              <button className="btn-ghost btn-sm" onClick={() => setShow((s) => ({ ...s, [f.id]: !s[f.id] }))}>
                <i className={`ti ti-${show[f.id] ? "eye-off" : "eye"}`} />
              </button>
            </div>
            <div className="disclaimer" style={{ marginTop: 4 }}>{f.hint}</div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
          <button className="btn-primary" onClick={save}><i className="ti ti-device-floppy" /> Save to vault</button>
          <button className="btn" onClick={lock}><i className="ti ti-lock" /> Lock</button>
          {saved && <span className="mono" style={{ fontSize: 11, color: "var(--positive)" }}>✓ saved · encrypted in this browser</span>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3><i className="ti ti-brand-google" /> Connected accounts</h3>
        <div className="lyr">
          <span className="lk"><i className="ti ti-mail" style={{ color: "var(--accent-bright)" }} /> Gmail — sends compliant mailers</span>
          {gmail
            ? <span style={{ display: "flex", gap: 8, alignItems: "center" }}><Sev kind="ok">connected</Sev><button className="btn-ghost btn-sm" onClick={() => { setGmail(false); ls("lot_gmail_connected", "0"); }}>disconnect</button></span>
            : <button className="btn btn-sm" onClick={() => { setGmail(true); ls("lot_gmail_connected", "1"); }}><i className="ti ti-plug" /> Connect</button>}
        </div>
        <div className="disclaimer" style={{ marginTop: 6 }}>OAuth (scope <span className="mono">gmail.send</span>) runs server-side in production — see INTEGRATION-SPEC.md §2b. This toggle is a prototype stand-in.</div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3><i className="ti ti-adjustments" /> Run &amp; automation</h3>
        <div className="lyr"><span className="lk">Weekly data refresh <span className="mono" style={{ color: "var(--text-tertiary)", fontSize: 10 }}>refresh-market.ts</span></span><Toggle on onClick={() => {}} /></div>
        <div className="lyr"><span className="lk">New-distress alerts → Brief</span><Toggle on onClick={() => {}} /></div>
        <div className="lyr"><span className="lk">Mail budget cap</span><span className="mono" style={{ fontSize: 12 }}>$240 / mo</span></div>
      </div>

      <div className="disclaimer" style={{ marginTop: 14 }}>Informational, not legal or financial advice.</div>
    </div>
  );
}
window.SettingsScreen = SettingsScreen;
