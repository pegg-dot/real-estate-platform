"use client";
import { useEffect, useState } from "react";

// The default passcode is just a "hide it from myself" gate, not real security — it keeps the
// rarely/never-needed setup commands out of the main app so it stays simple. Override with
// NEXT_PUBLIC_DEV_PASSCODE in .env if you want a different one.
const PASSCODE = process.env.NEXT_PUBLIC_DEV_PASSCODE || "lot-dev";

export default function DevPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState(false);

  useEffect(() => { if (sessionStorage.getItem("lot_dev_ok") === "1") setUnlocked(true); }, []);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code === PASSCODE) { sessionStorage.setItem("lot_dev_ok", "1"); setUnlocked(true); }
    else setErr(true);
  }

  if (!unlocked) {
    return (
      <div className="page" style={{ maxWidth: 420, textAlign: "center", paddingTop: 60 }}>
        <h1 style={{ fontSize: 18, marginBottom: 6 }}>🔒 Developer area</h1>
        <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
          Rarely-needed setup commands live here, out of the way. You don’t need this for day-to-day use — everything you’d actually touch is a button under <a href="/settings">Settings</a>.
        </p>
        <form onSubmit={submit} style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <input type="password" value={code} onChange={(e) => { setCode(e.target.value); setErr(false); }} placeholder="passcode"
            style={{ padding: "9px 12px", border: `1px solid ${err ? "#ef4444" : "#cbd5e1"}`, borderRadius: 8, fontSize: 14 }} autoFocus />
          <button type="submit" style={{ padding: "9px 18px", border: "none", background: "#0f172a", color: "#fff", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Unlock</button>
        </form>
        {err && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>Wrong passcode.</p>}
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Developer notes</h1>
      <p className="muted" style={{ marginBottom: 4 }}>
        These are setup / power-user commands you’ll rarely or never run. They live here, gated, so the main app stays clean.
        Day-to-day, you never need this page — use <a href="/settings">Settings</a>.
      </p>
      <p className="muted" style={{ fontSize: 12, marginBottom: 20 }}>Run these from a terminal in the project root.</p>

      <Group title="One-time cloud automation (run the weekly update even when your laptop is off)">
        <p style={{ fontSize: 13, margin: "0 0 8px" }}>
          The app already auto-updates whenever you open it (Settings → Automatic updates). This makes it also run on a schedule in the cloud — optional.
        </p>
        <ol style={{ fontSize: 13, lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
          <li>Push this repo to GitHub.</li>
          <li>GitHub → repo <b>Settings → Secrets and variables → Actions</b> → add a secret named <Code>SUPABASE_DB_URL</Code> (your Supabase pooler connection string).</li>
          <li>GitHub → <b>Actions</b> tab → enable workflows. Done — it runs every Monday ~7am ET.</li>
        </ol>
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>The job (<Code>.github/workflows/weekly-refresh.yml</Code>) skips itself cleanly until that secret exists, so nothing breaks before you enable it.</p>
      </Group>

      <Group title="First-time setup (already done — here for a fresh machine)">
        <Cmd c="npm install && (cd web && npm install)" d="Install dependencies (root engine + web app)." />
        <Cmd c="npx tsx scripts/apply-migrations.ts" d="Apply all database migrations to Supabase." />
        <Cmd c="npm run refresh -- --market Charlottesville --distress" d="First full county data pull + distress + scoring (also the 'Update everything' button)." />
      </Group>

      <Group title="Power-user thesis modes (the UI covers the common cases)">
        <Cmd c="npm run thesis -- --compare 1 2" d="Compare two thesis versions in the terminal. (Now also in the UI: Thesis → Compare two versions.)" />
        <Cmd c="npm run thesis -- --generic" d="Generate a sensible starter thesis without describing one." />
        <Cmd c="npm run thesis -- --guided" d="Step-by-step guided thesis interview in the terminal." />
      </Group>

      <Group title="Diagnostics (you’ll basically never need these)">
        <Cmd c="npx tsx scripts/measure-rerank.ts" d="Measures how much a thesis change re-ranks deals — a dev sanity check." />
        <Cmd c="npm test" d="Run the full test suite (~178 tests)." />
      </Group>

      <p className="muted" style={{ fontSize: 12, marginTop: 24 }}>
        <button onClick={() => { sessionStorage.removeItem("lot_dev_ok"); setUnlocked(false); }} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", textDecoration: "underline", padding: 0, fontSize: 12 }}>Lock this area</button>
      </p>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 22, border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px" }}>
    <h2 style={{ fontSize: 14, marginBottom: 10 }}>{title}</h2>{children}
  </div>;
}
function Cmd({ c, d }: { c: string; d: string }) {
  return <div style={{ marginBottom: 10 }}>
    <Code block>{c}</Code>
    <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{d}</div>
  </div>;
}
function Code({ children, block }: { children: React.ReactNode; block?: boolean }) {
  return <code style={{ display: block ? "block" : "inline", background: "#0f172a", color: "#e2e8f0", padding: block ? "7px 10px" : "1px 5px", borderRadius: 5, fontSize: 12.5, fontFamily: "ui-monospace, monospace" }}>{children}</code>;
}
