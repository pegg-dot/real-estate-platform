"use client";
import Link from "next/link";
import { useState } from "react";
import Icon from "../components/Icon";
import AsyncState from "../components/AsyncState";
import { useResource } from "../lib/useResource";
interface BriefRow { queue: string; title: string; reason: string; action: string; target: string }
const QUEUES = [
  { key: "REGULATORY_KILL", label: "Review regulatory risk", icon: "shield", color: "var(--critical)", href: "/radar" },
  { key: "ACT_ON_DEAL", label: "Make a deal decision", icon: "pipeline", color: "var(--accent)", href: "/deals" },
  { key: "ZONE_OPENED", label: "Explore zoning changes", icon: "radar", color: "var(--positive)", href: "/radar" },
  { key: "MAIL", label: "Prepare this week's outreach", icon: "mail", color: "var(--landmark)", href: "/outreach" },
  { key: "VERIFY_ZONING", label: "Close an evidence gap", icon: "search", color: "var(--warn)", href: "/map" },
];
export default function BriefPage() {
  const resource = useResource<{ rows: BriefRow[]; summary: string }>("/api/brief");
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ text: string; error: boolean } | null>(null);
  async function act(key: string, body: Record<string, unknown>) {
    if (busy) return; setBusy(key); setResult(null);
    try { const response = await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) }); const data = await response.json(); if (!response.ok || !data.ok) throw new Error(); setResult({ text: data.output || "Action completed.", error: false }); resource.reload(); }
    catch { setResult({ text: "The action result was not confirmed. Check Activity before retrying.", error: true }); }
    finally { setBusy(null); }
  }
  const rows = resource.data?.rows ?? [];
  return <div className="page brief-page"><div className="page-heading"><div><div className="page-eyebrow">Your action brief</div><h1>Know what needs attention.</h1><p>Work through the queue with the evidence and the next action in the same place.</p></div><button className="btn" onClick={resource.reload} disabled={resource.loading}><Icon name="refresh" size={14} />Refresh brief</button></div><div className="brief-toolbar"><button className="btn-primary" disabled={!!busy} onClick={() => act("generate", { action: "generate-leads" })}><Icon name="leads" size={15} />{busy === "generate" ? "Generating..." : "Generate leads"}</button><button className="btn" disabled={!!busy} onClick={() => act("retune", { action: "propose-retune" })}><Icon name="target" size={15} />{busy === "retune" ? "Computing..." : "Propose a thesis adjustment"}</button><span>Suggestions and drafts are not external sends.</span></div>{result && <div className={`operation-result${result.error ? " is-error" : ""}`} role={result.error ? "alert" : "status"}><Icon name={result.error ? "warning" : "check"} size={15} /><pre>{result.text}</pre></div>}
    {resource.loading ? <AsyncState loading title="Preparing your action brief" /> : resource.error ? <AsyncState error title="The brief is unavailable" description={resource.error} retry={resource.reload} /> : <>{resource.data?.summary && <p className="brief-summary">{resource.data.summary}</p>}{!rows.length && <div className="panel"><AsyncState title="Your action queue is clear" description="Generate leads from your current market, or start by adding a property to the pipeline." action={{ href: "/map", label: "Explore properties" }} /></div>}{QUEUES.map(queue => { const group = rows.filter(row => row.queue === queue.key); return group.length ? <section className="brief-queue" key={queue.key}><h2><Icon name={queue.icon} size={17} /><span>{queue.label}</span><small>{group.length}</small></h2>{group.map((row, i) => <article className="brief-task" key={`${row.target}:${i}`}><span className="task-rule" style={{ background: queue.color }} /><div><h3>{row.title}</h3><p>{row.reason}</p></div>{queue.key === "MAIL" ? <button className="btn" disabled={!!busy} onClick={() => act(row.target, { action: "draft-mailer", leadId: row.target })}>{busy === row.target ? "Drafting..." : "Prepare draft"}</button> : queue.key === "ZONE_OPENED" ? <button className="btn" disabled={!!busy} onClick={() => act("generate", { action: "generate-leads" })}>Source leads</button> : <Link className="btn" href={queue.href}>Review<Icon name="right" size={13} /></Link>}</article>)}</section> : null; })}</>}
  </div>;
}
