"use client";
/* Sign-in (spec 026 Phase 2). Only reachable/meaningful when AUTH_ENABLED. Self-contained Google
   sign-in (our own OAuth client → signed session cookie). Allowlisted emails only. */
import { useEffect, useState } from "react";

const MESSAGES: Record<string, string> = {
  "not-allowed": "That Google account isn't on the allowlist for this workspace.",
  "denied": "Sign-in was cancelled.",
  "bad-state": "Sign-in expired — please try again.",
  "no-email": "Couldn't read your email from Google — try again.",
  "auth-off": "Sign-in is currently disabled on this deployment.",
};

export default function Login() {
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("e");
    if (e) setErr(MESSAGES[e] ?? (e.startsWith("error") ? "Sign-in failed — please try again." : "Sign-in failed."));
  }, []);
  return (
    <div className="page" style={{ maxWidth: 420, marginTop: "12vh", textAlign: "center" }}>
      <h1 style={{ marginBottom: 6 }}>LOT</h1>
      <p className="muted" style={{ fontSize: 13, marginBottom: 20 }}>Your buy-and-hold operating terminal. Sign in to continue.</p>
      {err && <div style={{ background: "var(--critical-wash, #2a1414)", border: "1px solid var(--critical)", color: "var(--critical)", borderRadius: "var(--radius-md)", padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>{err}</div>}
      <a className="btn-primary" href="/api/auth/google" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px" }}>
        <i className="ti ti-brand-google" /> Sign in with Google
      </a>
      <p className="muted" style={{ fontSize: 11, marginTop: 16 }}>Access is limited to allowlisted accounts.</p>
    </div>
  );
}
