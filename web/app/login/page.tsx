"use client";
/* Sign-in (spec 026 Phase 2). Standalone full-screen entry — no app chrome (TopNav hides on /login).
   Split landing: left brand panel (what LOT is), right focused Google sign-in card. Self-contained
   Google OAuth (our own client → signed session cookie). Allowlisted emails only. */
import { useEffect, useState } from "react";

const MESSAGES: Record<string, string> = {
  "not-allowed": "That Google account isn't on the allowlist for this workspace.",
  "denied": "Sign-in was cancelled.",
  "bad-state": "Sign-in expired — please try again.",
  "no-email": "Couldn't read your email from Google — try again.",
  "auth-off": "Sign-in is currently disabled on this deployment.",
};

const FEATURES: Array<[string, string]> = [
  ["chart-dots-3", "Per-parcel scoring against your thesis — by-the-room legality, risk, and returns."],
  ["coin", "A creative-finance engine: cash, seller-finance, and subject-to with the legal guardrails."],
  ["map-pin", "Charlottesville · UVA student rentals — owner intelligence, leads, and a live deal pipeline."],
];

export default function Login() {
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("e");
    if (e) setErr(MESSAGES[e] ?? (e.startsWith("error") ? "Sign-in failed — please try again." : "Sign-in failed."));
  }, []);

  return (
    <div className="login-shell">
      {/* ── Left: brand / what-it-is panel ── */}
      <section className="login-brand">
        <div className="login-brand-inner">
          <div className="login-mark">
            <span className="login-logo">L</span>
            <div>
              <div className="login-wordmark">LOT</div>
              <div className="login-subtag">Land of Opportunity Terminal</div>
            </div>
          </div>
          <h1 className="login-headline">Your buy-and-hold operating terminal.</h1>
          <ul className="login-features">
            {FEATURES.map(([icon, text]) => (
              <li key={icon}>
                <i className={`ti ti-${icon}`} aria-hidden />
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <div className="login-foot">Find, score, and finance rentals — informational, not legal or financial advice.</div>
        </div>
      </section>

      {/* ── Right: sign-in card ── */}
      <section className="login-pane">
        <div className="login-card">
          <h2 className="login-card-title">Sign in</h2>
          <p className="login-card-sub">Use your allowlisted Google account to continue.</p>
          {err && <div className="login-error">{err}</div>}
          <a className="login-google" href="/api/auth/google">
            <i className="ti ti-brand-google" aria-hidden /> Sign in with Google
          </a>
          <p className="login-note">Access is limited to allowlisted accounts.</p>
        </div>
      </section>

      <style>{`
        .login-shell {
          position: fixed; inset: 0; display: flex;
          background: var(--bg-base); color: var(--text-primary); font-family: var(--font-sans);
        }
        /* brand panel */
        .login-brand {
          flex: 1 1 54%; position: relative; display: flex; align-items: center;
          padding: 0 7vw; border-right: 1px solid var(--border-soft);
          background:
            radial-gradient(120% 90% at 0% 0%, rgba(200,120,92,.10), transparent 60%),
            linear-gradient(150deg, var(--bg-chrome), var(--bg-base));
          overflow: hidden;
        }
        .login-brand::before {           /* subtle terminal grid */
          content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .5;
          background-image:
            linear-gradient(var(--border-soft) 1px, transparent 1px),
            linear-gradient(90deg, var(--border-soft) 1px, transparent 1px);
          background-size: 46px 46px;
          -webkit-mask-image: radial-gradient(110% 90% at 10% 10%, #000 30%, transparent 75%);
                  mask-image: radial-gradient(110% 90% at 10% 10%, #000 30%, transparent 75%);
        }
        .login-brand-inner { position: relative; max-width: 520px; }
        .login-mark { display: flex; align-items: center; gap: 14px; margin-bottom: 34px; }
        .login-logo {
          width: 52px; height: 52px; flex: none; display: grid; place-items: center;
          border-radius: var(--radius-md); background: var(--accent); color: var(--text-onaccent);
          font: 500 26px/1 var(--font-display); box-shadow: var(--shadow-md);
        }
        .login-wordmark { font: 500 26px/1 var(--font-display); letter-spacing: .04em; }
        .login-subtag { color: var(--text-tertiary); font-size: 12px; letter-spacing: .14em; text-transform: uppercase; margin-top: 4px; }
        .login-headline { font: 500 34px/1.18 var(--font-display); margin: 0 0 30px; color: var(--text-primary); }
        .login-features { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 18px; }
        .login-features li { display: flex; gap: 13px; align-items: flex-start; color: var(--text-secondary); font-size: 14.5px; line-height: 1.5; }
        .login-features i { color: var(--accent-bright); font-size: 18px; margin-top: 1px; flex: none; }
        .login-foot { margin-top: 38px; color: var(--text-tertiary); font-size: 12px; }
        /* sign-in pane */
        .login-pane { flex: 1 1 46%; display: flex; align-items: center; justify-content: center; padding: 24px; background: var(--bg-chrome); }
        .login-card {
          width: 100%; max-width: 372px; padding: 34px 32px;
          background: var(--bg-panel); border: 1px solid var(--border-soft);
          border-radius: var(--radius-lg); box-shadow: var(--shadow-float); text-align: center;
        }
        .login-card-title { font: 500 22px/1.2 var(--font-display); margin: 0 0 6px; }
        .login-card-sub { color: var(--text-secondary); font-size: 13.5px; margin: 0 0 22px; }
        .login-error {
          background: var(--critical-wash); border: 1px solid var(--critical); color: var(--score-weak-text);
          border-radius: var(--radius-md); padding: 9px 12px; font-size: 13px; margin-bottom: 16px; text-align: left;
        }
        .login-google {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          width: 100%; padding: 13px 18px; border-radius: var(--radius-sm);
          background: var(--accent); color: var(--text-onaccent); font-size: 15px; font-weight: 600;
          text-decoration: none; box-shadow: var(--shadow-sm); transition: background .15s ease, transform .05s ease;
        }
        .login-google:hover { background: var(--accent-bright); }
        .login-google:active { background: var(--accent-deep); transform: translateY(1px); }
        .login-google i { font-size: 18px; }
        .login-note { color: var(--text-tertiary); font-size: 11.5px; margin: 16px 0 0; }
        /* responsive: stack on narrow screens, hide the brand grid weight */
        @media (max-width: 820px) {
          .login-brand { display: none; }
          .login-pane { flex: 1 1 100%; }
        }
      `}</style>
    </div>
  );
}
