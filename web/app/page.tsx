"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "./components/Icon";
import AsyncState from "./components/AsyncState";
import { useWorkspace } from "./components/WorkspaceShell";
import { useResource } from "./lib/useResource";
import { displayParcels, humanize, type ParcelCollection } from "./lib/propertyPresentation";
import { Score, tierOf, usd, pct } from "./ui";
import DealPanel from "./DealPanel";

interface BriefRow { queue: string; title: string; reason: string; action: string; target: string }
interface Thesis { version: number; mode: string | null; primary: string | null; is_active: boolean }
const QUEUES: Record<string, { label: string; href: string; action: string; icon: string }> = {
  REGULATORY_KILL: { label: "Risk review", href: "/radar", action: "Review restrictions", icon: "warning" },
  ACT_ON_DEAL: { label: "Deal decision", href: "/deals", action: "Open pipeline", icon: "pipeline" },
  ZONE_OPENED: { label: "Zoning update", href: "/radar", action: "Explore changes", icon: "radar" },
  MAIL: { label: "Outreach", href: "/brief", action: "Review draft action", icon: "mail" },
  VERIFY_ZONING: { label: "Due diligence", href: "/brief", action: "Review evidence", icon: "shield" },
};

export default function Home() {
  const { market } = useWorkspace();
  const parcels = useResource<ParcelCollection>("/api/parcels?lens=score");
  const brief = useResource<{ rows: BriefRow[]; summary: string }>("/api/brief");
  const theses = useResource<{ theses: Thesis[] }>("/api/theses");
  const refresh = useResource<{ autoEnabled: boolean; lastRefreshAgeDays: number | null; isDue: boolean }>("/api/automation");
  const [selected, setSelected] = useState<string | null>(null);
  const [autoMsg, setAutoMsg] = useState<string | null>(null);
  // Preserve the existing auto-refresh tick, but never describe a triggered job as a completed refresh.
  useEffect(() => {
    let live = true;
    fetch("/api/automation", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
      .then(response => response.ok ? response.json() : null)
      .then(result => { if (live && result?.triggered) setAutoMsg("A data refresh has been requested. Follow its status in Settings & data."); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  const features = Array.isArray(parcels.data?.features) ? parcels.data.features : [];
  const top = displayParcels(features, "", "all", "score").slice(0, 5);
  const active = theses.data?.theses?.find(thesis => thesis.is_active);
  const count = (n: number) => parcels.loading ? "..." : parcels.error ? "Unavailable" : n.toLocaleString("en-US");
  const age = refresh.data?.lastRefreshAgeDays;
  const freshness = refresh.error ? "Refresh status unavailable" : refresh.loading ? "Checking refresh status" : age == null ? "No recorded data refresh" : age < 1 ? "Last refresh started today" : `Last refresh started ${Math.floor(age)} days ago`;
  const rows = Array.isArray(brief.data?.rows) ? brief.data.rows : [];
  return <div className="page overview-page">
    <div className="page-heading"><div><div className="page-eyebrow">{market} / Acquisition workspace</div><h1>A clearer view of your next move.</h1><p>Review the opportunities. Understand the tradeoffs. Decide what deserves your attention.</p></div><div className="heading-actions"><Link href="/chat" className="btn"><Icon name="chat" size={15} />Ask LOT</Link><Link href="/map" className="btn-primary">Explore properties<Icon name="right" size={15} /></Link></div></div>
    {autoMsg && <div className="inline-notice" style={{ marginBottom: 20 }} role="status"><Icon name="refresh" size={16} /><span>{autoMsg} <Link href="/settings">View controls</Link></span></div>}
    <div className="overview-stats">
      <Metric icon="building" label="Scored properties" value={count(features.length)} note="Geocoded, above the confidence floor" />
      <Metric icon="target" label="Strong thesis matches" value={count(features.filter(f => f.properties.score >= 70).length)} note="Thesis score of 70 or above" highlight />
      <Metric icon="shield" label="Need constraint review" value={count(features.filter(f => !f.properties.gatePassed).length)} note="One or more screening gates failed" />
      <Metric icon="layers" label="Active thesis" value={theses.loading ? "..." : theses.error ? "Unavailable" : active ? `v${active.version}` : "Not set"} note={active ? humanize(active.primary) : "Your criteria drive every ranking"} />
    </div>
    <div className="overview-grid"><div className="overview-primary"><section className="panel" aria-label="Property shortlist"><div className="panel-heading"><div><h2>Start with your strongest matches</h2><p>Ranked by thesis fit. Review assumptions before acting.</p></div><Link href="/map">View all<Icon name="diagonal" size={13} /></Link></div>
      {parcels.loading ? <AsyncState loading title="Building your shortlist" description="Loading your scored property data." /> : parcels.error ? <AsyncState error title="Your shortlist is unavailable" description={parcels.error} retry={parcels.reload} /> : !top.length ? <div className="first-run"><h2>Make this workspace yours.</h2><p>Your first data refresh turns an empty workspace into a property shortlist. Start with the setup guide, then define the criteria that matter to you.</p><div className="setup-steps"><SetupStep number="01" title="Load your market" detail="Follow the self-hosting quick start to import parcels." href="/settings" /><SetupStep number="02" title="Define your investment thesis" detail="Set a goal and the constraints behind your rankings." href="/thesis" /><SetupStep number="03" title="Review a property" detail="Use the list immediately; connect Mapbox for the map." href="/map" /></div></div> : <><table className="shortlist-table"><thead><tr><th>Property</th><th className="numeric optional-column">Estimated value</th><th className="numeric">Modeled CoC</th><th className="numeric">Fit</th></tr></thead><tbody>{top.map(({ properties: p }) => <tr key={p.apn}><td><button className="property-link" onClick={() => setSelected(p.apn)}>{p.address ?? p.apn}</button><span className="property-meta">{p.gatePassed ? humanize(p.use) : "Constraint review needed"}</span></td><td className="numeric optional-column">{usd(p.price)}</td><td className="numeric">{pct(p.bestUseCoc ?? p.coc)}</td><td className="numeric"><Score value={Math.round(p.score)} tier={tierOf(p.score)} /></td></tr>)}</tbody></table><div className="table-footnote">CoC = annual cash-on-cash return. Values and returns are analytical estimates, not listing prices or verified yields.</div></>}
    </section><div className="workflow-strip"><Workflow href="/deals" icon="pipeline" title="Move a deal forward" detail="Keep decisions and their reasons together." /><Workflow href="/leads" icon="leads" title="Find your next conversation" detail="Review ranked owner leads and outreach." /><Workflow href="/rents" icon="coin" title="Strengthen the evidence" detail="Replace rent assumptions with real comps." /></div></div>
    <div className="overview-secondary"><section className="panel"><div className="panel-heading"><div><h2>Needs your attention</h2><p>Your current action brief</p></div><span className="pill">{brief.loading ? "..." : brief.error ? "Unavailable" : rows.length}</span></div>{brief.loading ? <AsyncState loading title="Checking your action queue" /> : brief.error ? <AsyncState error title="Could not load the brief" description="Your property shortlist is still available. Retry the action queue separately." retry={brief.reload} /> : !rows.length ? <AsyncState title="Nothing in the queue" description="Generate leads in the action brief, or start by reviewing a property." action={{ href: "/brief", label: "Open action brief" }} /> : <div className="priority-list">{rows.slice(0, 4).map((row, index) => { const config = QUEUES[row.queue] ?? { label: "Review", href: "/brief", action: "Open brief", icon: "brief" }; return <article key={`${row.queue}:${row.target}:${index}`} className="priority-item"><Icon name={config.icon} size={17} /><div><div className="priority-label">{config.label}</div><h3>{row.title}</h3><p>{row.reason}</p><Link href={config.href}>{config.action}<Icon name="right" size={12} /></Link></div></article>; })}</div>}</section>
    <section className="panel thesis-panel"><div className="section-label"><span>THE INVESTMENT LENS</span><Icon name="target" size={17} /></div><h2>{active ? humanize(active.primary) : "Better criteria. Better decisions."}</h2><p>{active ? `Thesis v${active.version} is active. Rankings reflect this profile, not a universal verdict on a property.` : "Tell LOT what a good investment looks like for you. The thesis connects your goals to the shortlist."}</p><Link className="text-action" href="/thesis">{active ? "Review investment thesis" : "Set your investment thesis"}<Icon name="right" size={13} /></Link></section></div></div>
    <footer className="overview-footer"><span><Icon name="clock" size={13} />{freshness}<Link href="/settings">Manage data</Link></span><span>Public-record research. Modeled analysis. Human decisions.</span></footer>
    {selected && <DealPanel key={selected} apn={selected} onClose={() => setSelected(null)} />}
  </div>;
}
function Metric({ icon, label, value, note, highlight }: { icon: string; label: string; value: string; note: string; highlight?: boolean }) { return <div className={`overview-stat${highlight ? " is-highlighted" : ""}`}><span className="stat-label"><Icon name={icon} size={14} />{label}</span><strong className="stat-value" style={value === "Unavailable" ? { fontSize: 18 } : undefined}>{value}</strong><span className="stat-note">{note}</span></div>; }
function Workflow({ href, icon, title, detail }: { href: string; icon: string; title: string; detail: string }) { return <Link className="workflow-link" href={href}><Icon name={icon} size={20} /><strong>{title}<Icon name="diagonal" size={13} /></strong><small>{detail}</small></Link>; }
function SetupStep({ number, title, detail, href }: { number: string; title: string; detail: string; href: string }) { return <Link className="setup-step" href={href}><span>{number}</span><div><strong>{title}</strong><small>{detail}</small></div><Icon name="right" size={16} /></Link>; }
