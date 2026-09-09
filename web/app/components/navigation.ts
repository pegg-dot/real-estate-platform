export const NAV_GROUPS = [
  { label: "Workspace", items: [
    { href: "/", label: "Overview", icon: "overview", description: "Your next moves and strongest property matches" },
    { href: "/map", label: "Properties", icon: "map", description: "Search parcels, compare returns, and explore the map" },
    { href: "/deals", label: "Pipeline", icon: "pipeline", description: "Move a deal from watchlist to ownership" },
    { href: "/leads", label: "Leads", icon: "leads", description: "Review owners and prepare your outreach" },
    { href: "/brief", label: "Action brief", icon: "brief", description: "Review the prioritized action queue" },
  ] },
  { label: "Intelligence", items: [
    { href: "/chat", label: "Ask LOT", icon: "chat", description: "Work with the research and execution agents" },
    { href: "/thesis", label: "Investment thesis", icon: "target", description: "Set the criteria that drive property rankings" },
    { href: "/changes", label: "Market changes", icon: "changes", description: "See what changed since the last refresh" },
    { href: "/radar", label: "Regulatory watch", icon: "radar", description: "Review zoning opportunities and risks" },
    { href: "/rents", label: "Rent evidence", icon: "coin", description: "Add real comparables to improve estimates" },
    { href: "/learn", label: "Decision feedback", icon: "sparkles", description: "Review proposed changes to your thesis" },
  ] },
  { label: "Operations", items: [
    { href: "/portfolio", label: "Portfolio", icon: "building", description: "Review holdings, capital, and next-buy analysis" },
    { href: "/outreach", label: "Outreach", icon: "mail", description: "Review drafts and approve individual sends" },
    { href: "/schedule", label: "Schedule", icon: "calendar", description: "Manage follow-ups, calls, and visits" },
    { href: "/activity", label: "Activity log", icon: "activity", description: "Inspect actions and their recorded outcomes" },
  ] },
] as const;
export const SUPPORT_NAV = [
  { href: "/playbook", label: "Playbook", icon: "book", description: "Understand the acquisition and financing playbook" },
  { href: "/settings", label: "Settings & data", icon: "settings", description: "Configure connections, refresh data, and manage access" },
] as const;
export const ALL_NAV = [...NAV_GROUPS.flatMap(g => [...g.items]), ...SUPPORT_NAV];
export function activeRoute(path: string, href: string) { return path === href || (href !== "/" && path.startsWith(href + "/")); }
export function searchNavigation(query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return ALL_NAV.filter(item => terms.every(term => `${item.label} ${item.description} ${item.href}`.toLowerCase().includes(term)));
}
