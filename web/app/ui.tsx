"use client";
/* LOT terminal — shared UI atoms (ported from design/ui_kits/terminal/ui.jsx).
   Markup/class names kept identical to the kit so the design stays auditable; mock data swapped
   for props. Styling lives in globals.css (ported from kit.css). */
import type { ReactNode, CSSProperties } from "react";

export type Tier = "strong" | "moderate" | "weak";

/** the score/risk ramp: strong ≥70 (green) · moderate 50–69 (ochre) · weak <50 (clay red) */
export const tierOf = (score: number): Tier => (score >= 70 ? "strong" : score >= 50 ? "moderate" : "weak");

export const usd = (n: number | string | null | undefined): string => {
  if (n == null || n === "") return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${Math.round(v).toLocaleString()}`;
};
export const pct = (n: number | null | undefined, digits = 1): string =>
  n == null || !Number.isFinite(Number(n)) ? "—" : `${(Number(n) * 100).toFixed(digits)}%`;

export function Score({ value, tier, solid }: { value: number; tier: Tier; solid?: boolean }) {
  return <span className={`score ${tier}${solid ? " solid" : ""}`}>{value}</span>;
}

export function ScoreDot({ value, tier, size = 28 }: { value: number; tier: Tier; size?: number }) {
  const bg = { strong: "var(--score-strong)", moderate: "var(--score-moderate)", weak: "var(--score-weak)" }[tier];
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", background: bg, color: "var(--text-oncolor)",
      display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
      fontSize: size * 0.4, boxShadow: "0 1px 3px rgba(0,0,0,.5), inset 0 0 0 1.5px rgba(255,255,255,.32)" }}>{value}</span>
  );
}

export function Sev({ kind, children }: { kind: "critical" | "warn" | "ok"; children: ReactNode }) {
  return <span className={`sev ${kind}`}>{children}</span>;
}

export function Chip({ kind, mono, children }: { kind?: "info"; mono?: boolean; children: ReactNode }) {
  return <span className={`chip${kind ? " " + kind : ""}${mono ? " mono" : ""}`}>{children}</span>;
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="eyebrow" style={style}>{children}</div>;
}

export function Tile({ k, v, d, dColor }: { k: ReactNode; v: ReactNode; d?: ReactNode; dColor?: string }) {
  return <div className="tile"><div className="k">{k}</div><div className="v">{v}</div>
    {d && <div className="d" style={{ color: dColor || "var(--text-tertiary)" }}>{d}</div>}</div>;
}

export function Bar({ label, pct: p, color }: { label: ReactNode; pct: number; color: string }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
    <span style={{ fontSize: 12, color: "var(--text-secondary)", width: 118, flex: "none" }}>{label}</span>
    <span className="bar-track"><span className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, p))}%`, background: color }} /></span>
  </div>;
}

export function Toggle({ on, onClick }: { on?: boolean; onClick?: () => void }) {
  return <span className={`sw${on ? " on" : ""}`} role="switch" aria-checked={!!on} tabIndex={0}
    onClick={onClick} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } }}><i /></span>;
}

export function KV({ k, v }: { k: ReactNode; v: ReactNode }) {
  return <div className="kv"><span className="k">{k}</span><span className="v">{v}</span></div>;
}

export function Btn({ kind = "btn", icon, children, onClick, disabled, title }:
  { kind?: "btn" | "primary" | "ghost" | "danger" | "sm"; icon?: string; children?: ReactNode; onClick?: () => void; disabled?: boolean; title?: string }) {
  const cls = kind === "primary" ? "btn-primary" : kind === "ghost" ? "btn-ghost" : kind === "sm" ? "btn btn-sm" : "btn";
  return <button className={cls} onClick={onClick} disabled={disabled} title={title}>{icon && <i className={`ti ti-${icon}`} />}{children}</button>;
}

export function Callout({ children, action }: { children: ReactNode; action?: { label: string; onClick: () => void } }) {
  return <div className="callout"><i className="ti ti-bulb i" /><div className="t">{children}</div>
    {action && <button className="btn btn-sm" onClick={action.onClick}>{action.label}</button>}</div>;
}

/** bar color by component score (matches the kit's barColor) */
export const barColor = (key: string, p: number): string =>
  /risk/i.test(key) ? "var(--critical)" : p >= 70 ? "var(--score-strong)" : p >= 45 ? "var(--score-moderate)" : "var(--score-weak)";
