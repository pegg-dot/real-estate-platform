"use client";
import Link from "next/link";
import { useState } from "react";
import Icon from "../components/Icon";
import AsyncState from "../components/AsyncState";
import DealCard from "./DealCard";
export interface PipelineDeal { id: string; apn: string; stage: string; address: string | null; score: number | null; updated_at: string; recommended_structure: string | null }
const STAGES = [["watch", "Watching"], ["analyzing", "Under review"], ["offer", "Offer"], ["under_contract", "Under contract"], ["owned", "Owned"], ["exited", "Exited"], ["passed", "Passed"]];
export default function PipelineBoard({ deals }: { deals: PipelineDeal[] }) {
  const [search, setSearch] = useState("");
  const [archive, setArchive] = useState(false);
  const shown = deals.filter(deal => `${deal.address ?? ""} ${deal.apn}`.toLowerCase().includes(search.toLowerCase()));
  const active = deals.filter(deal => !["exited", "passed"].includes(deal.stage));
  return <div className="page wide pipeline-page">
    <div className="page-heading"><div><div className="page-eyebrow">Deal management</div><h1>Keep the next decision in sight.</h1><p>Every stage change keeps its reason. Your decisions help refine your investment thesis.</p></div><Link href="/map" className="btn-primary"><Icon name="plus" size={14} />Find a property</Link></div>
    <div className="pipeline-metrics"><span><strong>{active.length}</strong> active deals</span><span><strong>{deals.filter(d => d.stage === "analyzing").length}</strong> under review</span><span><strong>{deals.filter(d => d.stage === "under_contract").length}</strong> under contract</span></div>
    <div className="pipeline-controls"><label className="explorer-search pipeline-search"><Icon name="search" size={15} /><input type="search" style={{ border: 0, padding: 0, background: "transparent", boxShadow: "none", fontFamily: "var(--font-sans)" }} aria-label="Search pipeline" placeholder="Find a deal..." value={search} onChange={event => setSearch(event.target.value)} /></label><label className="archive-control"><input type="checkbox" checked={archive} onChange={event => setArchive(event.target.checked)} />Include exited &amp; passed</label></div>
    {!deals.length && <div className="panel" style={{ marginBottom: 24 }}><AsyncState title="Start your first deal" description="Open a property and choose Track this deal. It will appear here, ready for your first review." action={{ href: "/map", label: "Explore properties" }} /></div>}
    {!!deals.length && !shown.length && <div className="inline-notice" role="status">No deals match this search. Try another address or parcel ID.</div>}
    <div className="board" aria-label="Deal stages">{STAGES.filter(([key]) => archive || !["exited", "passed"].includes(key)).map(([stage, label]) => { const items = shown.filter(d => d.stage === stage); return <section key={stage} className="col" style={{ minWidth: 210, width: "auto", flex: "1 0 210px" }} aria-label={label}><div className="col-head"><span className={`stage-dot stage-${stage}`} /><h2 className="eyebrow">{label}</h2><span className="stage-count">{items.length}</span></div><div className="col-body">{items.map(deal => <DealCard key={deal.id} dealId={deal.id} apn={deal.apn} stage={deal.stage} address={deal.address} score={deal.score} structure={deal.recommended_structure} />)}{!items.length && <p className="col-empty">No deals in this stage</p>}</div></section>; })}</div>
    <p className="pipeline-footnote">Moving a card records a decision; it does not execute a contract or complete a transaction.</p>
  </div>;
}
