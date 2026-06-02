"use client";
import { useEffect, useState } from "react";

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

export default function DealPanel({ apn, onClose }: { apn: string; onClose: () => void }) {
  const [d, setD] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [trackMsg, setTrackMsg] = useState<string | null>(null);

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

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dossier?apn=${encodeURIComponent(apn)}`)
      .then((r) => r.json()).then((j) => setD(j)).finally(() => setLoading(false));
  }, [apn]);

  const components = (d?.components ?? {}) as Record<string, { weight: number; weighted: number }>;
  const financing = (d?.financing ?? {}) as {
    recommended?: Array<{ structure?: string; sellerPitch?: string; legalGuardrail?: string; attorneyReviewRequired?: boolean }>;
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

  return (
    <div style={{ position: "absolute", top: 0, right: 0, height: "100%", width: 380, background: "#fff",
      boxShadow: "-2px 0 12px rgba(0,0,0,0.15)", overflowY: "auto", padding: "16px 18px", fontSize: 13 }}>
      <button onClick={onClose} style={{ float: "right", border: "none", background: "none", fontSize: 18, cursor: "pointer" }}>×</button>
      {loading && <p className="muted">Loading…</p>}
      {d && !d.error && (
        <>
          <h2 style={{ fontSize: 16, marginBottom: 2 }}>{String(d.address ?? d.apn)}</h2>
          <div className="muted" style={{ marginBottom: 10 }}>Parcel {String(d.apn)} · Zone {String(d.zone_code ?? "—")}</div>

          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
            <Stat label="Score" value={`${Math.round(Number(d.score))}/100`} big />
            <Stat label="Headline CoC" value={pct(d.headline_coc)} big />
            <Stat label="Confidence" value={d.data_confidence != null ? Number(d.data_confidence).toFixed(2) : "—"} />
          </div>
          <div className="muted" style={{ marginBottom: 10 }}>
            {String(d.headline_model ?? "").replace(/_/g, "-")} · range {pct(d.coc_low)}–{pct(d.coc_high)} ·
            by-room {d.by_room_legal === true ? "legal ✓" : d.by_room_legal === false ? "NOT legal" : "unknown"}
          </div>

          {gateFailures.length > 0 && (
            <div style={{ background: "#fef3c7", color: "#92400e", padding: "6px 8px", borderRadius: 6, marginBottom: 10 }}>
              ⚠️ Constraint flag: {gateFailures[0]}
            </div>
          )}

          <button onClick={track} disabled={tracking} style={{ width: "100%", padding: "8px", border: "1px solid #0f172a", background: "#0f172a", color: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            {tracking ? "Tracking…" : "＋ Track this deal"}
          </button>
          {trackMsg && <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{trackMsg} <a href="/deals">→ Pipeline</a></div>}

          <Section title="Snapshot (real)">
            <Row k="Assessed value" v={usd(d.est_market_value)} />
            <Row k="Beds" v={d.beds != null ? String(d.beds) : "unknown"} />
            <Row k="Owner" v={`${String(d.owner_name ?? "—")} (${String(d.owner_entity_type ?? "?")})${d.is_absentee ? " · absentee" : ""}`} />
            {d.last_arms_price != null && <Row k="Last sale" v={`${usd(d.last_arms_price)}${d.last_arms_date ? ` (${String(d.last_arms_date).slice(0, 10)})` : ""}`} />}
            {d.flood_zone != null && <Row k="Flood zone" v={String(d.flood_zone)} />}
          </Section>

          <Section title="Score breakdown">
            {Object.entries(components).map(([k, c]) => (
              <Row key={k} k={k.replace(/_/g, " ")} v={`${(c.weight * 100).toFixed(0)}% → ${c.weighted >= 0 ? "+" : ""}${c.weighted.toFixed(1)}`} />
            ))}
          </Section>

          {distress.length > 0 && (
            <Section title="Distress signals (real)">
              {distress.map((s, i) => <span key={i} className="pill flag" style={{ marginRight: 4 }}>{s.signal_type.replace(/_/g, " ")}</span>)}
            </Section>
          )}

          {financing.recommended && financing.recommended.length > 0 && (
            <Section title="Financing (ranked)">
              {financing.recommended.map((o, i) => (
                <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: i < financing.recommended!.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                  <div><strong>{i + 1}. {String(o.structure ?? "cash").replace(/_/g, " ")}</strong>{o.attorneyReviewRequired ? " ⚠️ attorney review" : ""}</div>
                  {o.sellerPitch && <div className="muted" style={{ marginTop: 2 }}>{o.sellerPitch}</div>}
                  {o.legalGuardrail && <div style={{ marginTop: 4, fontSize: 11, color: "#7c2d12" }}>⚖️ {o.legalGuardrail}</div>}
                </div>
              ))}
              {financing.suppressed && financing.suppressed.length > 0 && (
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  Suppressed: {financing.suppressed.map((s) => String(s.structure).replace(/_/g, " ")).join(", ")} (don&apos;t fit).
                </div>
              )}
            </Section>
          )}

          {exitMenu.ranked && exitMenu.ranked.length > 0 && (
            <Section title="Exit-strategy menu (ranked, spec 019)">
              <div className="muted" style={{ marginBottom: 4 }}>Recommended: <strong>{String(d.recommended_exit_strategy ?? "—").replace(/_/g, " ")}</strong></div>
              {exitMenu.ranked.map((s, i) => (
                <div key={i}>
                  <Row k={`${i + 1}. ${s.strategy.replace(/_/g, " ")}${s.rentBasis === "hud_fmr" ? " (HUD FMR)" : ""}`} v={`${pct(s.cashOnCash)} CoC`} />
                  {s.guardrail && <div style={{ fontSize: 11, color: "#7c2d12", marginBottom: 4 }}>⚖️ {s.guardrail}</div>}
                </div>
              ))}
              {exitMenu.excluded && exitMenu.excluded.length > 0 && (
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Excluded: {exitMenu.excluded.map((e) => e.strategy).join(", ")}</div>
              )}
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Per-strategy rents are modeled multipliers; Section 8 uses the real HUD FMR floor.</div>
            </Section>
          )}

          {hbu.ranked && hbu.ranked.length > 0 && (
            <Section title="Best use of the dirt (HBU, spec 020)">
              <Row k="Recommended use" v={String(d.recommended_use ?? "—")} />
              {hbu.landSharePct != null && <Row k="Land share" v={`${Number(hbu.landSharePct).toFixed(0)}%`} />}
              {hbu.ranked.map((u, i) => (
                <Row key={i} k={u.use} v={`${pct(u.annualizedReturn)}/yr${u.upsideVsHold > 0 ? ` (+${pct(u.upsideVsHold)} vs hold)` : ""}`} />
              ))}
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>modeled screening estimate — not an appraisal</div>
            </Section>
          )}

          {!owner && (
            <button onClick={loadOwner} disabled={loadingOwner} style={{ width: "100%", padding: "7px", border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, marginTop: 12 }}>
              {loadingOwner ? "Looking up…" : "👤 Who is this owner? (portfolio + research)"}
            </button>
          )}
          {owner && (
            <Section title="Owner intelligence">
              <div style={{ fontWeight: 600 }}>{owner.owner.name ?? "—"} <span className="muted">({owner.owner.entity_type ?? "?"}{owner.owner.is_absentee ? " · absentee" : ""})</span></div>
              <div style={{ margin: "6px 0", padding: "6px 8px", background: "#eff6ff", borderRadius: 6 }}>
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
                <div style={{ margin: "6px 0", padding: "8px 10px", background: "#fefce8", borderRadius: 6, fontSize: 12.5 }}>
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

          <button onClick={loadFull} disabled={loadingMd} style={{ width: "100%", padding: "7px", border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, marginTop: 12 }}>
            {loadingMd ? "Generating…" : "📄 View full cited dossier (HUD floor, sensitivity, citations)"}
          </button>
          {dossierMd && <pre style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: 10, borderRadius: 6, fontSize: 11, overflowX: "auto", marginTop: 8, whiteSpace: "pre-wrap" }}>{dossierMd}</pre>}

          <div className="muted" style={{ marginTop: 14, fontSize: 11 }}>Informational, not legal or financial advice.</div>
        </>
      )}
      {d?.error ? <p className="muted">Not found.</p> : null}
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return <div><div className="muted" style={{ fontSize: 11 }}>{label}</div>
    <div style={{ fontSize: big ? 20 : 15, fontWeight: 700 }}>{value}</div></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginTop: 14 }}>
    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", marginBottom: 6, fontWeight: 700 }}>{title}</div>
    {children}</div>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
    <span className="muted">{k}</span><span style={{ textAlign: "right" }}>{v}</span></div>;
}
