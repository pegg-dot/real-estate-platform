"use client";
/* Connections panel (spec 026 Phase 3): connect your Google account so the agents can send email
   (gmail.send) and add calendar events (calendar.events) as you. Tokens are stored encrypted; you
   approve every send. Only live when the deployment has the Google client env configured. */
import { useEffect, useState, useCallback } from "react";

interface Conn { kind: string; status: string; email: string | null; updatedAt: string | null }

export default function Connectors() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [conns, setConns] = useState<Conn[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const j = await fetch("/api/connect/status").then((r) => r.json()).catch(() => null);
    if (j) { setConfigured(!!j.configured); setConns(j.connectors ?? []); }
  }, []);

  useEffect(() => {
    load();
    // surface the OAuth callback result (?connect=connected|denied|bad-state|error:…)
    const p = new URLSearchParams(window.location.search).get("connect");
    if (p) {
      setNote(p === "connected" ? "✓ Google connected — Gmail send + Calendar are live for you."
        : p === "denied" ? "Connection cancelled."
        : p.startsWith("error") ? `Couldn't connect: ${p.slice(6)}`
        : "Couldn't connect (please retry).");
      window.history.replaceState({}, "", "/settings");
    }
  }, [load]);

  async function disconnect() {
    if (!confirm("Disconnect Google? The agents will no longer be able to send email or add events as you.")) return;
    setBusy(true);
    await fetch("/api/connect/status", { method: "DELETE" }).catch(() => {});
    setBusy(false);
    load();
  }

  if (configured === null) return <div className="card" style={{ maxWidth: 480 }}><span className="muted">Loading connections…</span></div>;

  const google = conns.find((c) => c.kind === "google");
  return (
    <div className="card" style={{ maxWidth: 480 }}>
      {note && <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{note}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <i className="ti ti-brand-google" style={{ fontSize: 18, color: "var(--accent-bright)" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>Google — Gmail &amp; Calendar</div>
          <div className="muted" style={{ fontSize: 11 }}>
            {!configured ? "Not configured on this deployment yet (operator sets GOOGLE_CLIENT_ID / SECRET + CONNECTOR_SECRET)."
              : google?.status === "connected" ? `Connected${google.email ? ` as ${google.email}` : ""} · sends/schedules as you`
              : "Send owner emails + add calendar events as you. Scopes: send-only email + create events. You approve each action."}
          </div>
        </div>
        {configured && (google?.status === "connected"
          ? <button className="btn btn-sm" onClick={disconnect} disabled={busy}>Disconnect</button>
          : <a className="btn-primary btn-sm" href="/api/connect/google">Connect</a>)}
      </div>
    </div>
  );
}
