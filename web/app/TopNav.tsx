"use client";
/* LOT top chrome (ported from design/ui_kits/terminal/App.jsx topbar): brand mark, tab nav with
   active state, LIVE pulse. Every existing route is kept — LOT-DECISION: rule#1 don't drop wiring,
   just restyle. Active tab derived from the pathname. */
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// primary tabs get a Tabler icon; the rest stay as compact text links (all routes preserved).
const PRIMARY: Array<{ href: string; label: string; icon: string }> = [
  { href: "/map", label: "Map", icon: "map-2" },
  { href: "/chat", label: "Chat", icon: "message-2" },   // unified Explainer/Operator/Interrogator/Coach (spec 024)
  { href: "/brief", label: "Brief", icon: "news" },
  { href: "/portfolio", label: "Portfolio", icon: "building-community" },
  { href: "/leads", label: "Leads", icon: "inbox" },
  { href: "/deals", label: "Pipeline", icon: "layout-kanban" },
];
const SECONDARY: Array<{ href: string; label: string }> = [
  { href: "/thesis", label: "Thesis" },
  { href: "/playbook", label: "Playbook" },
  { href: "/changes", label: "Changes" },
  { href: "/radar", label: "Radar" },
  { href: "/learn", label: "Learn" },
  { href: "/rents", label: "Rents" },
  { href: "/outreach", label: "Outreach" },
  { href: "/schedule", label: "Schedule" },
  { href: "/activity", label: "Activity" },
  { href: "/settings", label: "Settings" },
];

export default function TopNav() {
  const path = usePathname() || "/";
  const isActive = (href: string) => path === href || (href !== "/" && path.startsWith(href));
  // identity chip — only shows when multi-user auth is on (single-user shows nothing, unchanged)
  const [me, setMe] = useState<{ authEnabled: boolean; email: string | null } | null>(null);
  useEffect(() => { fetch("/api/me").then((r) => r.json()).then(setMe).catch(() => {}); }, []);
  if (path === "/login") return null;   // login is a standalone full-screen entry — no app chrome
  return (
    <nav className="topbar">
      <a href="/" className="brand" aria-label="LOT home">
        <span className="logo">L</span>
        <span className="name">LOT</span>
      </a>
      {PRIMARY.map((t) => (
        <a key={t.href} href={t.href} className={isActive(t.href) ? "active" : ""}>
          <i className={`ti ti-${t.icon}`} aria-hidden /> {t.label}
        </a>
      ))}
      <span style={{ width: 1, height: 18, background: "var(--border-soft)", margin: "0 2px" }} />
      {SECONDARY.map((t) => (
        <a key={t.href} href={t.href} className={isActive(t.href) ? "active" : ""}>{t.label}</a>
      ))}
      <span className="live"><span className="dot" /> live</span>
      <span className="loc">Charlottesville · preview</span>
      {me?.authEnabled && me.email && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
          <span className="muted" style={{ fontSize: 11 }} title={me.email}>
            <i className="ti ti-user-circle" /> {me.email.split("@")[0]}
          </span>
          <form action="/api/auth/logout" method="post" style={{ display: "inline" }}>
            <button type="submit" className="muted" title="Sign out" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 11, padding: 0 }}>
              <i className="ti ti-logout" /> sign out
            </button>
          </form>
        </span>
      )}
    </nav>
  );
}
