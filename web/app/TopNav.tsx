"use client";
/* LOT top chrome (ported from design/ui_kits/terminal/App.jsx topbar): brand mark, tab nav with
   active state, LIVE pulse. Every existing route is kept — LOT-DECISION: rule#1 don't drop wiring,
   just restyle. Active tab derived from the pathname. */
import { usePathname } from "next/navigation";

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
  { href: "/settings", label: "Settings" },
];

export default function TopNav() {
  const path = usePathname() || "/";
  const isActive = (href: string) => path === href || (href !== "/" && path.startsWith(href));
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
    </nav>
  );
}
