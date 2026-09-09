"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Icon from "./Icon";
import { NAV_GROUPS, SUPPORT_NAV, ALL_NAV, activeRoute, searchNavigation } from "./navigation";
import { useResource } from "../lib/useResource";

const WorkspaceContext = createContext({ market: "Charlottesville" });
export const useWorkspace = () => useContext(WorkspaceContext);

function Sidebar({ onNavigate, mobile = false }: { onNavigate: () => void; mobile?: boolean }) {
  const pathname = usePathname();
  const { market } = useWorkspace();
  return <>
    <div className="workspace-brand"><Link href="/" onClick={onNavigate} aria-label="LOT overview"><span className="brand-mark"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M8 6v20h18M14 6v14h12M20 6v8h6" stroke="currentColor" strokeWidth="2" /></svg></span><span>LOT<span className="brand-caption">Acquisition workspace</span></span></Link>{mobile && <button className="icon-button" aria-label="Close navigation" onClick={onNavigate}><Icon name="close" /></button>}</div>
    <div className="workspace-market"><Icon name="pin" size={15} /><span>{market}</span><span className="workspace-tag">VA</span></div>
    <nav className="workspace-nav" aria-label={mobile ? "Mobile navigation" : "Main navigation"}>
      {NAV_GROUPS.map(group => <section className="nav-group" key={group.label}><h2>{group.label}</h2>{group.items.map(item => <Link key={item.href} href={item.href} onClick={onNavigate} prefetch={false} className={activeRoute(pathname, item.href) ? "nav-item is-active" : "nav-item"} aria-current={activeRoute(pathname, item.href) ? "page" : undefined}><Icon name={item.icon} size={17} /><span>{item.label}</span>{item.href === "/chat" && <span className="nav-ai">AI</span>}</Link>)}</section>)}
    </nav>
    <div className="sidebar-bottom">{SUPPORT_NAV.map(item => <Link key={item.href} href={item.href} onClick={onNavigate} prefetch={false} className={activeRoute(pathname, item.href) ? "nav-item is-active" : "nav-item"} aria-current={activeRoute(pathname, item.href) ? "page" : undefined}><Icon name={item.icon} size={17} /><span>{item.label}</span></Link>)}<div className="project-credit">Built by <a href="https://github.com/pegg-dot/real-estate-platform" target="_blank" rel="noreferrer">Nate Pegg<Icon name="diagonal" size={11} /></a></div></div>
  </>;
}

function CommandMenu({ dialog, onClose }: { dialog: React.RefObject<HTMLDialogElement | null>; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const router = useRouter();
  const matches = searchNavigation(query);
  const selected = Math.min(index, Math.max(0, matches.length - 1));
  const choose = (href: string) => { dialog.current?.close(); onClose(); setQuery(""); setIndex(0); router.push(href); };
  useEffect(() => { document.getElementById(`command-result-${selected}`)?.scrollIntoView({ block: "nearest" }); }, [selected]);
  return <dialog ref={dialog} className="command-dialog" aria-label="Go to a page" onClose={() => { setQuery(""); setIndex(0); onClose(); }} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
    <div className="command-inner"><div className="command-input"><Icon name="search" size={20} /><input autoFocus aria-label="Search pages" placeholder="Where would you like to go?" value={query} onChange={event => { setQuery(event.target.value); setIndex(0); }} role="combobox" aria-controls="command-results" aria-expanded="true" aria-autocomplete="list" aria-activedescendant={matches.length ? `command-result-${selected}` : undefined} onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setIndex(current => (current + (event.key === "ArrowDown" ? 1 : -1) + Math.max(1, matches.length)) % Math.max(1, matches.length)); } if (event.key === "Enter" && matches[selected]) { event.preventDefault(); choose(matches[selected].href); } }} /><button className="keyboard-key" onClick={() => dialog.current?.close()} aria-label="Close page search">Esc</button></div>
    <div className="command-results" id="command-results" role="listbox" aria-label="Pages">{matches.length === 0 ? <div className="command-no-results">No matching pages. Try properties, pipeline, or settings.</div> : matches.map((item, i) => <div key={item.href} role="option" id={`command-result-${i}`} aria-selected={i === selected} className={`command-result${i === selected ? " selected" : ""}`} onMouseMove={() => setIndex(i)} onClick={() => choose(item.href)}><Icon name={item.icon} /><span><strong>{item.label}</strong><small>{item.description}</small></span><Icon name="right" size={15} /></div>)}</div><div className="command-footer"><span>Search pages and workflows</span><span><kbd>↑</kbd><kbd>↓</kbd> to navigate <kbd>Enter</kbd> to open</span></div></div>
  </dialog>;
}

export default function WorkspaceShell({ children, market }: { children: ReactNode; market: string }) {
  const pathname = usePathname();
  const standalone = pathname === "/login";
  const command = useRef<HTMLDialogElement>(null);
  const mobile = useRef<HTMLDialogElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const health = useResource<{ ok: boolean }>(standalone ? null : "/api/health");
  const me = useResource<{ authEnabled: boolean; email: string | null }>(standalone ? null : "/api/me");
  const [commandOpen, setCommandOpen] = useState(false);
  const current = ALL_NAV.find(item => activeRoute(pathname, item.href));
  const openCommand = () => { mobile.current?.close(); command.current?.showModal(); setCommandOpen(true); };
  useEffect(() => {
    const handle = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); if (command.current?.open) command.current.close(); else { mobile.current?.close(); command.current?.showModal(); setCommandOpen(true); } } };
    if (!standalone) window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [standalone]);
  useEffect(() => { mobile.current?.close(); command.current?.close(); }, [pathname]);
  const connected = !health.error && health.data?.ok;
  return <WorkspaceContext.Provider value={{ market }}>{standalone ? children : <div className="workspace-shell">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <aside className="workspace-sidebar"><Sidebar onNavigate={() => {}} /></aside>
    <div className="workspace-main"><header className="workspace-topbar"><div className="workspace-breadcrumb"><button className="icon-button mobile-menu-button" aria-label="Open navigation" onClick={() => mobile.current?.showModal()}><Icon name="menu" /></button><span className="breadcrumb-market">{market}</span><span className="breadcrumb-separator">/</span><strong>{current?.label ?? "Workspace"}</strong></div><div className="workspace-top-actions"><button ref={searchTrigger} className="workspace-search" onClick={openCommand} aria-haspopup="dialog" aria-expanded={commandOpen}><Icon name="search" size={15} /><span>Go to...</span><kbd>Ctrl / ⌘ K</kbd></button><Link href="/settings" className={`connection-state ${connected ? "connected" : ""}`} title="Database connection at last check. Open settings for data refresh controls."><span />{health.loading ? "Connecting" : connected ? "Connected" : "Check connection"}</Link>{me.data?.authEnabled && me.data.email && <form action="/api/auth/logout" method="post"><button className="icon-button" title={`Sign out ${me.data.email}`} aria-label="Sign out"><Icon name="logout" size={16} /></button></form>}</div></header>
    <main id="main-content" className="workspace-content" tabIndex={-1}>{children}</main></div>
    <dialog ref={mobile} className="mobile-nav-dialog" aria-label="Navigation" onClick={event => { if (event.target === event.currentTarget) mobile.current?.close(); }}><div className="mobile-nav-inner"><Sidebar mobile onNavigate={() => mobile.current?.close()} /></div></dialog>
    <CommandMenu dialog={command} onClose={() => { setCommandOpen(false); }} />
  </div>}</WorkspaceContext.Provider>;
}
