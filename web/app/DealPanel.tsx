"use client";
// Property dossier: source data and existing actions, organized into focused reading tabs.
import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Icon from "./components/Icon";
import AsyncState from "./components/AsyncState";
import { useResource } from "./lib/useResource";
import { numberOrNull } from "./lib/propertyPresentation";
import { Score, Sev, Eyebrow, tierOf, barColor } from "./ui";
import { addContext } from "./chat/contextStore";

const usd = (value: unknown) => { const n = numberOrNull(value); return n == null ? "Not available" : `$${Math.round(n).toLocaleString("en-US")}`; };
const pct = (value: unknown) => { const n = numberOrNull(value); return n == null ? "Not available" : `${(n * 100).toFixed(1)}%`; };
type DetailTab = "overview" | "underwriting" | "owner" | "research";
const DetailContext = createContext<DetailTab>("overview");
const TABS: Array<[DetailTab, string]> = [["overview", "Overview"], ["underwriting", "Underwriting"], ["owner", "Owner"], ["research", "Research"]];
async function request(url: string, body?: Record<string, unknown>) {
  const response = await fetch(url, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) } : { signal: AbortSignal.timeout(180000) });
  const result = await response.json();
  if (!response.ok || result.error || result.ok === false) throw new Error("The request could not complete. Check Settings & data, then try again.");
  return result;
}

interface OwnerData {
  owner: { name: string | null; entity_type: string | null; is_absentee: boolean | null };
  portfolio: { count: number; totalValue: number; byRoomLegal: number; distressCount: number;
    parcels: Array<{ apn: string; address: string | null; est_market_value: string | null; distress: boolean }> };
  situation: { situation: string; approach: string; bestPlay: string; tone: string } | null;
  contact: { phones?: string[]; emails?: string[] } | null;
  intel: Array<{ category: string; source: string }>;
  links: Array<{ label: string; url: string }>;
}

interface InterrogationData {
  error?: string;
  address?: string;
  review?: {
    pace: { proposal: string; structure: string; citations: string[] };
    grant: { challenges: Array<{ concern: string; severity: "high" | "medium" | "low" }>; citations: string[] };
    synthesis: { verdict: string; recommendation: string; openRisks: string[] };
    interrogation: Array<{ question: string; answer: string; status: string; confidence: string; citations: string[] }>;
  };
}

export default function DealPanel(props: { apn: string; onClose: () => void }) {
  // A new parcel always gets new action state; never show the last parcel's owner/review.
  return <DossierContent key={props.apn} {...props} />;
}
function DossierContent({ apn, onClose }: { apn: string; onClose: () => void }) {
  const resource = useResource<Record<string, unknown>>(`/api/dossier?apn=${encodeURIComponent(apn)}`);
  const d = resource.data;
  const [tab, setTab] = useState<DetailTab>("overview");
  const dialog = useRef<HTMLDialogElement>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tracked, setTracked] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);
  function moveTab(event: React.KeyboardEvent, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % TABS.length : event.key === "ArrowLeft" ? (index + TABS.length - 1) % TABS.length : event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : null;
    if (next == null) return;
    event.preventDefault(); setTab(TABS[next][0]);
    dialog.current?.querySelector<HTMLButtonElement>(`#dossier-tab-${TABS[next][0]}`)?.focus();
  }
  const [tracking, setTracking] = useState(false);
  const [trackMsg, setTrackMsg] = useState<string | null>(null);
  const [addedToChat, setAddedToChat] = useState(false);

  const [dossierMd, setDossierMd] = useState<string | null>(null);
  const [loadingMd, setLoadingMd] = useState(false);
  const [owner, setOwner] = useState<OwnerData | null>(null);
  const [loadingOwner, setLoadingOwner] = useState(false);
  async function loadOwner() {
    setLoadingOwner(true); setActionError(null);
    try {
      await request("/api/actions", { action: "enrich-owner", apn });
      setOwner(await request(`/api/owner?apn=${encodeURIComponent(apn)}`));
    } catch { setActionError("Owner research could not complete. Check your data connection and configured providers, then retry."); }
    finally { setLoadingOwner(false); }
  }
  async function track() {
    if (tracking || tracked) return;
    setTracking(true); setTrackMsg(null); setActionError(null);
    try { await request("/api/actions", { action: "track-deal", apn }); setTracked(true); setTrackMsg("This property is now in your pipeline."); }
    catch { setActionError("The deal was not confirmed as tracked. Please retry or check the pipeline before making another change."); }
    finally { setTracking(false); }
  }
  async function loadFull() {
    setLoadingMd(true); setActionError(null);
    try { const result = await request("/api/actions", { action: "full-dossier", apn }); setDossierMd(result.output); }
    catch { setActionError("The full dossier could not be generated. Please try again."); }
    finally { setLoadingMd(false); }
  }
  const [interro, setInterro] = useState<InterrogationData | null>(null);
  const [loadingInterro, setLoadingInterro] = useState(false);
  async function interrogate() {
    setLoadingInterro(true); setInterro(null);
    try { setInterro(await request(`/api/interrogate?apn=${encodeURIComponent(apn)}`)); }
    catch { setInterro({ error: "Research could not complete. Check your AI provider and data connection, then retry." }); }
    finally { setLoadingInterro(false); }
  }

  const components = (d?.components ?? {}) as Record<string, { weight: number; weighted: number }>;
  const financing = (d?.financing ?? {}) as {
    recommended?: Array<{
      structure?: string; sellerPitch?: string; legalGuardrail?: string; attorneyReviewRequired?: boolean;
      buyer?: { cashInDeal?: number; capitalEfficiency?: string };
      capGains?: { sellerBenefit?: number; recaptureTax?: number; estGain?: number };
    }>;
    suppressed?: Array<{ structure?: string; reason?: string }>;
  };
  const gateFailures = (d?.gate_failures ?? []) as string[];
  const distress = (d?.distress ?? []) as Array<{ signal_type: string; severity: string }>;
  const exitMenu = (d?.exit_strategies ?? {}) as {
    ranked?: Array<{ strategy: string; cashOnCash: number; rentBasis?: string; guardrail?: string }>;
    excluded?: Array<{ strategy: string; reason: string }>;
  };
  const hbu = (d?.hbu ?? {}) as {
    landSharePct?: number | null;
    note?: string;
    ranked?: Array<{ use: string; annualizedReturn: number; upsideVsHold: number;
      detail?: { irrAnnual?: number; carry?: number; horizonMonths?: number } }>;
    excluded?: Array<{ use: string; reason: string }>;
  };

  const score = d?.score != null ? Math.round(Number(d.score)) : null;

  return (
    <dialog ref={dialog} className="slideover" aria-labelledby="dossier-title" onClose={onClose} onClick={event => { if (event.target === event.currentTarget && event.clientX < event.currentTarget.getBoundingClientRect().left) onClose(); }}>
      <div className="dossier-sticky">
        <div className="so-head">
          <div className="dossier-eyebrow"><span>PROPERTY DOSSIER</span><button onClick={onClose} className="close" aria-label="Close property dossier" autoFocus><Icon name="close" size={15} /></button></div>
          <div className="dossier-title-row"><div><h2 id="dossier-title">{d ? String(d.address ?? d.apn) : "Property details"}</h2><div className="muted mono" style={{ fontSize: 10 }}>PARCEL {apn}{d ? ` / ZONE ${String(d.zone_code ?? "Unknown")}` : ""}</div></div>{score != null && <Score value={score} tier={tierOf(score)} solid />}</div>
        </div>
        <div className="dossier-tabs" role="tablist" aria-label="Property dossier sections">{TABS.map(([key, label], index) => <button key={key} id={`dossier-tab-${key}`} role="tab" aria-selected={tab === key} aria-controls="dossier-tab-content" tabIndex={tab === key ? 0 : -1} onClick={() => setTab(key)} onKeyDown={event => moveTab(event, index)}>{label}</button>)}</div>
      </div>
      <div className="so-body">
        {resource.loading ? <AsyncState loading title="Loading the property dossier" /> : resource.error ? <AsyncState error title="This property could not be loaded" description={resource.error} retry={resource.reload} /> : d && (
          <>
            <div className="dossier-metrics">
              <Stat label="Estimated value" value={usd(d.est_market_value)} big />
              <Stat label="Modeled CoC" value={pct(d.headline_coc)} big />
              <Stat label="Data confidence" value={pct(d.data_confidence)} />
            </div>
            <div className="dossier-context">{String(d.headline_model ?? "Model not specified").replace(/_/g, " ")} / Estimated return range {pct(d.coc_low)} to {pct(d.coc_high)}.<br />By-room use: {d.by_room_legal === true ? "permitted in source rules; verify current requirements" : d.by_room_legal === false ? "not permitted in source rules" : "not established"}.</div>
            {gateFailures.length > 0 && <details className="dossier-warning" open><summary>{gateFailures.length} screening constraint{gateFailures.length === 1 ? "" : "s"} to review</summary><ul>{gateFailures.map((failure, index) => <li key={index}>{failure}</li>)}</ul></details>}
            {d.low_confidence === true && <p className="dossier-warning">Low data confidence. Review missing evidence before relying on these estimates.</p>}
            <div className="dossier-actions"><button onClick={track} disabled={tracking || tracked} className="btn-primary"><Icon name={tracked ? "check" : "plus"} size={14} />{tracking ? "Tracking..." : tracked ? "Tracked in pipeline" : "Track this deal"}</button><button className="btn" onClick={() => { addContext({ type: "parcel", id: apn, label: String(d.address ?? apn) }); setAddedToChat(true); }}><Icon name={addedToChat ? "check" : "chat"} size={14} />{addedToChat ? "Added to chat" : "Add to chat"}</button></div>
            {addedToChat && <p className="dossier-action-status" role="status">Property context attached. <Link href="/chat" onClick={onClose}>Open Ask LOT</Link></p>}
            {trackMsg && <p className="dossier-action-status" role="status">{trackMsg} <Link href="/deals" onClick={onClose}>Open pipeline</Link></p>}
            {actionError && <p className="dossier-warning" role="alert">{actionError}</p>}
            <DetailContext.Provider value={tab}><div id="dossier-tab-content" role="tabpanel" aria-labelledby={`dossier-tab-${tab}`} tabIndex={0}>
            <Section title="Property snapshot" badge={<Sev kind="ok">source records</Sev>}>
              <Row k="Estimated market value" v={usd(d.est_market_value)} />
              {d.latest_assessed != null && <Row k="Latest assessed value" v={usd(d.latest_assessed)} />}
              <Row k="Beds" v={d.beds != null ? String(d.beds) : "unknown"} />
              <Row k="Owner" v={`${String(d.owner_name ?? "—")} (${String(d.owner_entity_type ?? "?")})${d.is_absentee ? " · absentee" : ""}`} />
              {d.last_arms_price != null && <Row k="Last sale" v={`${usd(d.last_arms_price)}${d.last_arms_date ? ` (${String(d.last_arms_date).slice(0, 10)})` : ""}`} />}
              {d.flood_zone != null && <Row k="Flood zone" v={String(d.flood_zone)} />}
            </Section>

            <Section title="Score breakdown">
              {Object.entries(components).map(([k, c]) => {
                const neg = c.weighted < 0;                                  // risk penalty
                const raw = c.weight !== 0 ? Math.max(0, Math.min(100, c.weighted / c.weight)) : 0; // 0–100 component score
                const pct = neg ? Math.min(100, Math.abs(c.weighted) * 4) : raw;
                return (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", width: 116, flex: "none" }}>{k.replace(/_/g, " ")}</span>
                    <span className="bar-track"><span className="bar-fill" style={{ width: `${pct}%`, background: neg ? "var(--critical)" : barColor(k, raw) }} /></span>
                    <span className="mono" style={{ fontSize: 10.5, width: 50, textAlign: "right", color: "var(--text-tertiary)" }}>{neg ? "" : "+"}{c.weighted.toFixed(1)}</span>
                  </div>
                );
              })}
            </Section>

            {distress.length > 0 && (
              <Section title="Recorded distress signals">
                {distress.map((s, i) => <span key={i} className="sev warn" style={{ marginRight: 4 }}>{s.signal_type.replace(/_/g, " ")}</span>)}
              </Section>
            )}

            {financing.recommended && financing.recommended.length > 0 && (
              <Section tab="underwriting" title="Financing options" badge={<Sev kind="warn">modeled</Sev>}>
                {financing.recommended.map((o, i) => (
                  <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: i < financing.recommended!.length - 1 ? "1px solid var(--border-soft)" : "none" }}>
                    <div><strong>{i + 1}. {String(o.structure ?? "cash").replace(/_/g, " ")}</strong>{o.attorneyReviewRequired ? <> <Sev kind="warn">attorney review</Sev></> : null}</div>
                    {(o.buyer?.cashInDeal != null || o.capGains?.sellerBenefit != null) && (
                      <div style={{ marginTop: 3, fontSize: 11, display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {o.buyer?.cashInDeal != null && (
                          <span style={{ color: "var(--text-secondary)" }}> cash in deal <strong style={{ color: "var(--text-primary)" }}>${Math.round(o.buyer.cashInDeal).toLocaleString()}</strong></span>
                        )}
                        {o.capGains?.sellerBenefit != null && o.capGains.sellerBenefit > 0 && (
                          <span style={{ color: "var(--text-secondary)" }}> defers ~<strong style={{ color: "var(--positive)" }}>${Math.round(o.capGains.sellerBenefit).toLocaleString()}</strong> seller cap-gains tax vs a cash sale</span>
                        )}
                        {o.capGains?.recaptureTax != null && o.capGains.recaptureTax > 0 && (
                          <span className="muted" title="Modeled from an assumed 80% improvement basis / 27.5-yr straight-line schedule — verify against the seller's actual depreciation.">(~${Math.round(o.capGains.recaptureTax).toLocaleString()} recapture still owed at close · modeled)</span>
                        )}
                      </div>
                    )}
                    {o.sellerPitch && <div className="muted" style={{ marginTop: 2 }}>{o.sellerPitch}</div>}
                    {o.legalGuardrail && <div style={{ marginTop: 4, fontSize: 11, color: "var(--warn)" }}> {o.legalGuardrail}</div>}
                  </div>
                ))}
                {financing.suppressed && financing.suppressed.length > 0 && (
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                    Excluded: {financing.suppressed.map((s) => `${String(s.structure).replace(/_/g, " ")}${s.reason ? ` (${s.reason})` : ""}`).join("; ")}.
                  </div>
                )}
              </Section>
            )}

            <Section tab="research" title="AI-assisted due diligence">
              {(!interro || interro.error) && (
                <button onClick={interrogate} disabled={loadingInterro} className="btn-primary">
                  {loadingInterro ? "Interrogating…" : " Interrogate this deal"}
                </button>
              )}
              {interro?.error && <div style={{ color: "var(--critical)", fontSize: 12 }}> {interro.error}</div>}
              {interro?.review && (
                <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div><strong> Pace (structure):</strong> <span style={{ color: "var(--text-secondary)" }}>{interro.review.pace.proposal}</span></div>
                  <div>
                    <strong> Grant (challenges):</strong>
                    <ul style={{ margin: "4px 0", paddingLeft: 18 }}>
                      {interro.review.grant.challenges.map((c, i) => (
                        <li key={i} style={{ color: c.severity === "high" ? "var(--critical)" : c.severity === "medium" ? "var(--warn)" : "var(--text-secondary)" }}>
                          [{c.severity}] {c.concern}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div style={{ padding: 9, borderRadius: "var(--radius-sm)",
                    background: interro.review.synthesis.verdict === "needs_more_diligence" ? "var(--critical-wash)" : interro.review.synthesis.verdict === "proceed_with_caution" ? "var(--warn-wash)" : "var(--positive-wash)" }}>
                    <strong> {interro.review.synthesis.verdict.replace(/_/g, " ").toUpperCase()}</strong>
                    <div style={{ marginTop: 2, color: "var(--text-secondary)" }}>{interro.review.synthesis.recommendation}</div>
                    {interro.review.synthesis.openRisks.length > 0 && (
                      <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                        {interro.review.synthesis.openRisks.map((r, i) => <li key={i} className="muted">{r}</li>)}
                      </ul>
                    )}
                  </div>
                  <details>
                    <summary style={{ cursor: "pointer", color: "var(--text-secondary)" }}>Q&amp;A diligence ({interro.review.interrogation.length})</summary>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                      {interro.review.interrogation.map((q, i) => (
                        <div key={i}>
                          <div style={{ fontWeight: 600 }}>{q.status === "needs_data" ? "○" : "●"} {q.question}</div>
                          <div className="muted">{q.answer}{q.citations.length ? ` [${q.citations.join(", ")}]` : ""}</div>
                        </div>
                      ))}
                    </div>
                  </details>
                  <div className="muted" style={{ fontSize: 11 }}>Distilled personas from a cited source — informational, not legal/financial advice or the real person.</div>
                </div>
              )}
            </Section>

            {exitMenu.ranked && exitMenu.ranked.length > 0 && (
              <Section tab="underwriting" title="Exit strategies" badge={<Sev kind="warn">modeled</Sev>}>
                <div className="muted" style={{ marginBottom: 4 }}>Recommended: <strong>{String(d.recommended_exit_strategy ?? "—").replace(/_/g, " ")}</strong></div>
                {exitMenu.ranked.map((s, i) => (
                  <div key={i}>
                    <Row k={`${i + 1}. ${s.strategy.replace(/_/g, " ")}${s.rentBasis === "hud_fmr" ? " (HUD FMR)" : ""}`} v={`${pct(s.cashOnCash)} CoC`} />
                    {s.guardrail && <div style={{ fontSize: 11, color: "var(--warn)", marginBottom: 4 }}> {s.guardrail}</div>}
                  </div>
                ))}
                {exitMenu.excluded && exitMenu.excluded.length > 0 && (
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Excluded: {exitMenu.excluded.map((e) => `${e.strategy}${e.reason ? ` (${e.reason})` : ""}`).join("; ")}</div>
                )}
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Per-strategy rents are modeled multipliers; Section 8 uses the real HUD FMR floor.</div>
              </Section>
            )}

            {hbu.ranked && hbu.ranked.length > 0 && (
              <Section tab="underwriting" title="Highest and best use" badge={<Sev kind="warn">modeled</Sev>}>
                <Row k="Recommended use" v={String(d.recommended_use ?? "—")} />
                {hbu.landSharePct != null && <Row k="Land share" v={`${Number(hbu.landSharePct).toFixed(0)}%`} />}
                {hbu.ranked.map((u, i) => {
                  // develop/flip carry an IRR pro-forma; show the carry drag + capital-tied-up months
                  const c = u.detail;
                  const carryNote = c && (c.carry || c.horizonMonths)
                    ? ` · ${c.horizonMonths ?? "?"}mo${c.carry ? `, ~$${Math.round(c.carry).toLocaleString()} carry` : ""}`
                    : "";
                  const isIrr = c && c.irrAnnual != null && (u.use === "develop" || u.use === "flip");
                  return (
                    <Row key={i} k={u.use}
                      v={`${pct(u.annualizedReturn)}/yr${isIrr ? " IRR" : ""}${u.upsideVsHold > 0 ? ` (+${pct(u.upsideVsHold)} vs hold)` : ""}${carryNote}`} />
                  );
                })}
                {hbu.excluded && hbu.excluded.length > 0 && (
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                    Excluded: {hbu.excluded.map((e) => `${e.use} (${e.reason})`).join(" · ")}
                  </div>
                )}
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{hbu.note ?? "modeled screening estimate — not an appraisal"}</div>
              </Section>
            )}

            {tab === "owner" && !owner && (
              <button onClick={loadOwner} disabled={loadingOwner} className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 12 }}>
                {loadingOwner ? "Looking up…" : " Who is this owner? (portfolio + research)"}
              </button>
            )}
            {owner && (
              <Section tab="owner" title="Owner intelligence">
                <div style={{ fontWeight: 600 }}>{owner.owner.name ?? "—"} <span className="muted">({owner.owner.entity_type ?? "?"}{owner.owner.is_absentee ? " · absentee" : ""})</span></div>
                <div style={{ margin: "6px 0", padding: "7px 9px", background: "var(--accent-wash)", borderRadius: "var(--radius-sm)" }}>
                  Owns <strong>{owner.portfolio.count}</strong> parcel(s) worth <strong>{usd(owner.portfolio.totalValue)}</strong>
                  {owner.portfolio.count > 1 ? " — a portfolio seller." : "."}{" "}
                  {owner.portfolio.byRoomLegal} by-room-legal · {owner.portfolio.distressCount} with distress.
                </div>
                {owner.portfolio.count > 1 && (
                  <div style={{ fontSize: 12, marginBottom: 6 }}>
                    {owner.portfolio.parcels.slice(0, 6).map((p, i) => (
                      <div key={i} className="muted">• {p.address ?? p.apn} ({usd(p.est_market_value)}){p.distress ? " " : ""}</div>
                    ))}
                  </div>
                )}
                {owner.situation && (
                  <div style={{ margin: "6px 0", padding: "8px 10px", background: "var(--warn-wash)", borderRadius: "var(--radius-sm)", fontSize: 12.5 }}>
                    <div><strong>Inferred situation (not verified):</strong> {owner.situation.situation}</div>
                    <div style={{ marginTop: 4 }}><strong>How to approach:</strong> {owner.situation.approach}</div>
                    <div style={{ marginTop: 4 }} className="muted">Best play: <strong>{owner.situation.bestPlay.replace(/_/g, " ")}</strong> · tone: {owner.situation.tone}</div>
                  </div>
                )}
                {owner.contact && (owner.contact.phones?.length || owner.contact.emails?.length) && (
                  <div style={{ fontSize: 12, marginBottom: 4 }}>
                     {(owner.contact.phones ?? []).join(", ") || "—"} · ✉ {(owner.contact.emails ?? []).join(", ") || "—"}
                  </div>
                )}
                <div style={{ fontSize: 12 }}>Research (no scraping — you click): {owner.links.map((l, i) => (
                  <a key={i} href={l.url} target="_blank" rel="noreferrer" style={{ marginRight: 8, textDecoration: "underline" }}>{l.label}</a>
                ))}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  {owner.intel.length > 0 ? `Enriched: ${owner.intel.map((x) => x.source).join(", ")}.` : "Contact/skip-trace enrichment lights up when a vendor key is added. Not a consumer report."}
                </div>
              </Section>
            )}

            {tab === "underwriting" && !financing.recommended?.length && !exitMenu.ranked?.length && !hbu.ranked?.length && <AsyncState title="No modeled options available" description="The dossier has no financing or use analysis for this property yet. Refresh the market and check its input data." />}
            </div></DetailContext.Provider>
            <button onClick={loadFull} disabled={loadingMd} className="btn dossier-export">
              {loadingMd ? "Generating…" : " View full cited dossier (HUD floor, sensitivity, citations)"}
            </button>
            {dossierMd && <pre style={{ background: "var(--bg-base)", border: "1px solid var(--border-soft)", padding: 10, borderRadius: "var(--radius-sm)", fontSize: 11, overflowX: "auto", marginTop: 8, whiteSpace: "pre-wrap", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{dossierMd}</pre>}

            <div className="disclaimer" style={{ marginTop: 14 }}>Informational, not legal or financial advice.</div>
          </>
        )}
      </div>
    </dialog>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return <div><div className="muted" style={{ fontSize: 11, color: "var(--text-secondary)" }}>{label}</div>
    <div className="dossier-stat" style={big ? undefined : { fontSize: 20 }}>{value}</div></div>;
}
function Section({ title, badge, children, tab = "overview" }: { title: string; badge?: ReactNode; children: ReactNode; tab?: DetailTab }) {
  const active = useContext(DetailContext);
  if (active !== tab) return null;
  return <div className="section">
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}><Eyebrow>{title}</Eyebrow>{badge}</div>
    {children}
  </div>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="kv"><span className="k">{k}</span><span className="v">{v}</span></div>;
}
