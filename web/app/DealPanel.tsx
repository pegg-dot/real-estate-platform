"use client";
/* LOT — deal slide-over (ported from design/ui_kits/terminal/DealDrawer.jsx). Dark drawer styling;
   ALL data wiring preserved (dossier, financing, interrogate, exit menu, HBU, owner intel, dossier
   md). LOT-DECISION rule#1: visual-only restyle — every fetch/handler/field is unchanged. */
import { useEffect, useState, type ReactNode } from "react";
import { Score, Sev, Eyebrow, tierOf, barColor } from "./ui";
import { addContext } from "./chat/contextStore";

const usd = (n: unknown) => (typeof n === "number" || (typeof n === "string" && n !== "")
  ? `$${Math.round(Number(n)).toLocaleString()}` : "—");
const pct = (n: unknown) => (n != null && n !== "" ? `${(Number(n) * 100).toFixed(1)}%` : "—");

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

export default function DealPanel({ apn, onClose }: { apn: string; onClose: () => void }) {
  const [d, setD] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [trackMsg, setTrackMsg] = useState<string | null>(null);
  const [addedToChat, setAddedToChat] = useState(false);

  const [dossierMd, setDossierMd] = useState<string | null>(null);
  const [loadingMd, setLoadingMd] = useState(false);
  const [owner, setOwner] = useState<OwnerData | null>(null);
  const [loadingOwner, setLoadingOwner] = useState(false);
  async function loadOwner() {
    setLoadingOwner(true);
    // run the funnel's ENRICH step (derive situation + any keyed vendors), then load the dossier
    await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "enrich-owner", apn }) }).catch(() => {});
    const r = await fetch(`/api/owner?apn=${encodeURIComponent(apn)}`).then((x) => x.json());
    setLoadingOwner(false);
    if (!r.error) setOwner(r);
  }

  async function track() {
    setTracking(true); setTrackMsg(null);
    const r = await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "track-deal", apn }) }).then((x) => x.json());
    setTracking(false);
    setTrackMsg(r.ok ? r.output : `⚠️ ${r.error}`);
  }
  async function loadFull() {
    setLoadingMd(true);
    const r = await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "full-dossier", apn }) }).then((x) => x.json());
    setLoadingMd(false);
    setDossierMd(r.ok ? r.output : `⚠️ ${r.error}`);
  }

  const [interro, setInterro] = useState<InterrogationData | null>(null);
  const [loadingInterro, setLoadingInterro] = useState(false);
  async function interrogate() {
    setLoadingInterro(true); setInterro(null);
    const r = await fetch(`/api/interrogate?apn=${encodeURIComponent(apn)}`).then((x) => x.json()).catch((e) => ({ error: String(e) }));
    setLoadingInterro(false);
    setInterro(r.error ? { error: r.error } : r);
  }

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dossier?apn=${encodeURIComponent(apn)}`)
      .then((r) => r.json()).then((j) => setD(j)).finally(() => setLoading(false));
  }, [apn]);

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
    ranked?: Array<{ use: string; annualizedReturn: number; upsideVsHold: number }>;
  };

  const score = d?.score != null ? Math.round(Number(d.score)) : null;

  return (
    <div className="slideover">
      <div className="so-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ font: "var(--text-h2)", marginBottom: 2 }}>{d ? String(d.address ?? d.apn) : "Loading…"}</h2>
          <div className="muted mono" style={{ fontSize: 11 }}>{d ? `${String(d.apn)} · zone ${String(d.zone_code ?? "—")}` : apn}</div>
        </div>
        {score != null && <Score value={score} tier={tierOf(score)} solid />}
        <button onClick={onClose} className="close" aria-label="Close">×</button>
      </div>

      <div className="so-body">
        {loading && <p className="muted">Loading…</p>}
        {d && !d.error && (
          <>
            <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
              <Stat label="Score" value={score != null ? `${score}/100` : "—"} big />
              <Stat label="Headline CoC" value={pct(d.headline_coc)} big />
              <Stat label="Confidence" value={d.data_confidence != null ? Number(d.data_confidence).toFixed(2) : "—"} />
            </div>
            <div className="muted" style={{ marginBottom: 10, fontSize: 12 }}>
              {String(d.headline_model ?? "").replace(/_/g, "-")} · range {pct(d.coc_low)}–{pct(d.coc_high)} ·
              by-room {d.by_room_legal === true ? "legal ✓" : d.by_room_legal === false ? "NOT legal" : "unknown"}
            </div>

            {gateFailures.length > 0 && (
              <div style={{ background: "var(--warn-wash)", color: "var(--warn)", padding: "6px 9px", borderRadius: "var(--radius-sm)", marginBottom: 10, fontSize: 12 }}>
                ⚠️ Constraint flag: {gateFailures[0]}
              </div>
            )}

            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <button onClick={track} disabled={tracking} className="btn-primary" style={{ flex: 1, justifyContent: "center" }}>
                {tracking ? "Tracking…" : "＋ Track this deal"}
              </button>
              <button className="btn" title="Attach this parcel to the chat (then open Chat and ask the agents about it)"
                onClick={() => { addContext({ type: "parcel", id: apn, label: String(d.address ?? apn) }); setAddedToChat(true); setTimeout(() => setAddedToChat(false), 1800); }}>
                {addedToChat ? "✓ added" : "💬 Add to chat"}
              </button>
            </div>
            {trackMsg && <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{trackMsg} <a href="/deals">→ Pipeline</a></div>}

            <Section title="Snapshot" badge={<Sev kind="ok">real</Sev>}>
              <Row k="Assessed value" v={usd(d.est_market_value)} />
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
              <Section title="Distress signals (real)">
                {distress.map((s, i) => <span key={i} className="sev warn" style={{ marginRight: 4 }}>{s.signal_type.replace(/_/g, " ")}</span>)}
              </Section>
            )}

            {financing.recommended && financing.recommended.length > 0 && (
              <Section title="Financing (ranked)" badge={<Sev kind="warn">modeled</Sev>}>
                {financing.recommended.map((o, i) => (
                  <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: i < financing.recommended!.length - 1 ? "1px solid var(--border-soft)" : "none" }}>
                    <div><strong>{i + 1}. {String(o.structure ?? "cash").replace(/_/g, " ")}</strong>{o.attorneyReviewRequired ? <> <Sev kind="warn">attorney review</Sev></> : null}</div>
                    {(o.buyer?.cashInDeal != null || o.capGains?.sellerBenefit != null) && (
                      <div style={{ marginTop: 3, fontSize: 11, display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {o.buyer?.cashInDeal != null && (
                          <span style={{ color: "var(--text-secondary)" }}>💵 cash in deal <strong style={{ color: "var(--text-primary)" }}>${Math.round(o.buyer.cashInDeal).toLocaleString()}</strong></span>
                        )}
                        {o.capGains?.sellerBenefit != null && o.capGains.sellerBenefit > 0 && (
                          <span style={{ color: "var(--text-secondary)" }}>🧾 defers ~<strong style={{ color: "var(--positive)" }}>${Math.round(o.capGains.sellerBenefit).toLocaleString()}</strong> seller cap-gains tax vs a cash sale</span>
                        )}
                        {o.capGains?.recaptureTax != null && o.capGains.recaptureTax > 0 && (
                          <span className="muted" title="Modeled from an assumed 80% improvement basis / 27.5-yr straight-line schedule — verify against the seller's actual depreciation.">(~${Math.round(o.capGains.recaptureTax).toLocaleString()} recapture still owed at close · modeled)</span>
                        )}
                      </div>
                    )}
                    {o.sellerPitch && <div className="muted" style={{ marginTop: 2 }}>{o.sellerPitch}</div>}
                    {o.legalGuardrail && <div style={{ marginTop: 4, fontSize: 11, color: "var(--warn)" }}>⚖️ {o.legalGuardrail}</div>}
                  </div>
                ))}
                {financing.suppressed && financing.suppressed.length > 0 && (
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                    Suppressed: {financing.suppressed.map((s) => String(s.structure).replace(/_/g, " ")).join(", ")} (don&apos;t fit).
                  </div>
                )}
              </Section>
            )}

            <Section title="Interrogate this deal (Pace structures · Grant challenges)">
              {!interro && (
                <button onClick={interrogate} disabled={loadingInterro} className="btn-primary">
                  {loadingInterro ? "Interrogating…" : "🔎 Interrogate this deal"}
                </button>
              )}
              {interro?.error && <div style={{ color: "var(--critical)", fontSize: 12 }}>⚠️ {interro.error}</div>}
              {interro?.review && (
                <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div><strong>🔨 Pace (structure):</strong> <span style={{ color: "var(--text-secondary)" }}>{interro.review.pace.proposal}</span></div>
                  <div>
                    <strong>🔎 Grant (challenges):</strong>
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
                    <strong>⚖️ {interro.review.synthesis.verdict.replace(/_/g, " ").toUpperCase()}</strong>
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
              <Section title="Exit-strategy menu (ranked, spec 019)" badge={<Sev kind="warn">modeled</Sev>}>
                <div className="muted" style={{ marginBottom: 4 }}>Recommended: <strong>{String(d.recommended_exit_strategy ?? "—").replace(/_/g, " ")}</strong></div>
                {exitMenu.ranked.map((s, i) => (
                  <div key={i}>
                    <Row k={`${i + 1}. ${s.strategy.replace(/_/g, " ")}${s.rentBasis === "hud_fmr" ? " (HUD FMR)" : ""}`} v={`${pct(s.cashOnCash)} CoC`} />
                    {s.guardrail && <div style={{ fontSize: 11, color: "var(--warn)", marginBottom: 4 }}>⚖️ {s.guardrail}</div>}
                  </div>
                ))}
                {exitMenu.excluded && exitMenu.excluded.length > 0 && (
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Excluded: {exitMenu.excluded.map((e) => e.strategy).join(", ")}</div>
                )}
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Per-strategy rents are modeled multipliers; Section 8 uses the real HUD FMR floor.</div>
              </Section>
            )}

            {hbu.ranked && hbu.ranked.length > 0 && (
              <Section title="Best use of the dirt (HBU, spec 020)" badge={<Sev kind="warn">modeled</Sev>}>
                <Row k="Recommended use" v={String(d.recommended_use ?? "—")} />
                {hbu.landSharePct != null && <Row k="Land share" v={`${Number(hbu.landSharePct).toFixed(0)}%`} />}
                {hbu.ranked.map((u, i) => (
                  <Row key={i} k={u.use} v={`${pct(u.annualizedReturn)}/yr${u.upsideVsHold > 0 ? ` (+${pct(u.upsideVsHold)} vs hold)` : ""}`} />
                ))}
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>modeled screening estimate — not an appraisal</div>
              </Section>
            )}

            {!owner && (
              <button onClick={loadOwner} disabled={loadingOwner} className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 12 }}>
                {loadingOwner ? "Looking up…" : "👤 Who is this owner? (portfolio + research)"}
              </button>
            )}
            {owner && (
              <Section title="Owner intelligence">
                <div style={{ fontWeight: 600 }}>{owner.owner.name ?? "—"} <span className="muted">({owner.owner.entity_type ?? "?"}{owner.owner.is_absentee ? " · absentee" : ""})</span></div>
                <div style={{ margin: "6px 0", padding: "7px 9px", background: "var(--accent-wash)", borderRadius: "var(--radius-sm)" }}>
                  Owns <strong>{owner.portfolio.count}</strong> parcel(s) worth <strong>{usd(owner.portfolio.totalValue)}</strong>
                  {owner.portfolio.count > 1 ? " — a portfolio seller." : "."}{" "}
                  {owner.portfolio.byRoomLegal} by-room-legal · {owner.portfolio.distressCount} with distress.
                </div>
                {owner.portfolio.count > 1 && (
                  <div style={{ fontSize: 12, marginBottom: 6 }}>
                    {owner.portfolio.parcels.slice(0, 6).map((p, i) => (
                      <div key={i} className="muted">• {p.address ?? p.apn} ({usd(p.est_market_value)}){p.distress ? " ⚠️" : ""}</div>
                    ))}
                  </div>
                )}
                {owner.situation && (
                  <div style={{ margin: "6px 0", padding: "8px 10px", background: "var(--warn-wash)", borderRadius: "var(--radius-sm)", fontSize: 12.5 }}>
                    <div><strong>Their likely situation:</strong> {owner.situation.situation}</div>
                    <div style={{ marginTop: 4 }}><strong>How to approach:</strong> {owner.situation.approach}</div>
                    <div style={{ marginTop: 4 }} className="muted">Best play: <strong>{owner.situation.bestPlay.replace(/_/g, " ")}</strong> · tone: {owner.situation.tone}</div>
                  </div>
                )}
                {owner.contact && (owner.contact.phones?.length || owner.contact.emails?.length) && (
                  <div style={{ fontSize: 12, marginBottom: 4 }}>
                    📞 {(owner.contact.phones ?? []).join(", ") || "—"} · ✉️ {(owner.contact.emails ?? []).join(", ") || "—"}
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

            <button onClick={loadFull} disabled={loadingMd} className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 12 }}>
              {loadingMd ? "Generating…" : "📄 View full cited dossier (HUD floor, sensitivity, citations)"}
            </button>
            {dossierMd && <pre style={{ background: "var(--bg-base)", border: "1px solid var(--border-soft)", padding: 10, borderRadius: "var(--radius-sm)", fontSize: 11, overflowX: "auto", marginTop: 8, whiteSpace: "pre-wrap", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{dossierMd}</pre>}

            <div className="disclaimer" style={{ marginTop: 14 }}>Informational, not legal or financial advice.</div>
          </>
        )}
        {d?.error ? <p className="muted">Not found.</p> : null}
      </div>
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return <div><div className="muted" style={{ fontSize: 11, color: "var(--text-secondary)" }}>{label}</div>
    <div style={{ font: big ? "var(--text-stat)" : "var(--text-body-md)", color: "var(--text-primary)", fontWeight: 700 }}>{value}</div></div>;
}
function Section({ title, badge, children }: { title: string; badge?: ReactNode; children: ReactNode }) {
  return <div className="section">
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}><Eyebrow>{title}</Eyebrow>{badge}</div>
    {children}
  </div>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="kv"><span className="k">{k}</span><span className="v">{v}</span></div>;
}
