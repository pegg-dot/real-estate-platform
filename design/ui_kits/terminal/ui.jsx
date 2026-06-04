/* LOT terminal — shared UI atoms. Exports to window for cross-file use. */
const { useState, useEffect, useRef } = React;

const usd = (n) => (typeof n === "number" ? (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${n.toLocaleString()}`) : n);

function Score({ value, tier, solid }) {
  return <span className={`score ${tier}${solid ? " solid" : ""}`}>{value}</span>;
}
function ScoreDot({ value, tier, size = 28 }) {
  const bg = { strong: "var(--score-strong)", moderate: "var(--score-moderate)", weak: "var(--score-weak)" }[tier];
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", background: bg, color: "var(--text-oncolor)",
      display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
      fontSize: size * 0.4, boxShadow: "0 1px 3px rgba(0,0,0,.5), inset 0 0 0 1.5px rgba(255,255,255,.32)" }}>{value}</span>
  );
}
function Sev({ kind, children }) { return <span className={`sev ${kind}`}>{children}</span>; }
function Chip({ kind, mono, children }) { return <span className={`chip${kind ? " " + kind : ""}${mono ? " mono" : ""}`}>{children}</span>; }
function Eyebrow({ children, style }) { return <div className="eyebrow" style={style}>{children}</div>; }

function Tile({ k, v, d, dColor }) {
  return <div className="tile"><div className="k">{k}</div><div className="v">{v}</div>
    {d && <div className="d" style={{ color: dColor || "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{d}</div>}</div>;
}
function Bar({ label, pct, color }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
    <span style={{ fontSize: 12, color: "var(--text-secondary)", width: 118, flex: "none" }}>{label}</span>
    <span className="bar-track"><span className="bar-fill" style={{ width: `${pct}%`, background: color }} /></span>
  </div>;
}
function Toggle({ on, onClick }) { return <span className={`sw${on ? " on" : ""}`} onClick={onClick}><i /></span>; }
function KV({ k, v }) { return <div className="kv"><span className="k">{k}</span><span className="v">{v}</span></div>; }

function Btn({ kind = "btn", icon, children, onClick, disabled }) {
  const cls = kind === "primary" ? "btn-primary" : kind === "ghost" ? "btn-ghost" : kind === "danger" ? "btn-danger" : "btn";
  return <button className={cls} onClick={onClick} disabled={disabled}>{icon && <i className={`ti ti-${icon}`} />}{children}</button>;
}
function Callout({ children, action }) {
  return <div className="callout"><i className="ti ti-bulb i" /><div className="t">{children}</div>
    {action && <button className="btn btn-sm" onClick={action.onClick}>{action.label}</button>}</div>;
}

const barColor = (k, pct) => k === "risk penalty" ? "var(--critical)"
  : pct >= 70 ? "var(--score-strong)" : pct >= 45 ? "var(--score-moderate)" : "var(--score-weak)";

Object.assign(window, { usd, Score, ScoreDot, Sev, Chip, Eyebrow, Tile, Bar, Toggle, KV, Btn, Callout, barColor });
