"use client";
import { useEffect, useState } from "react";

const usd = (n: unknown) => (typeof n === "number" || (typeof n === "string" && n !== "")
  ? `$${Math.round(Number(n)).toLocaleString()}` : "—");
const pct = (n: unknown) => (n != null && n !== "" ? `${(Number(n) * 100).toFixed(1)}%` : "—");

export default function DealPanel({ apn, onClose }: { apn: string; onClose: () => void }) {
  const [d, setD] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [trackMsg, setTrackMsg] = useState<string | null>(null);

  async function track() {
    setTracking(true); setTrackMsg(null);
    const r = await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "track-deal", apn }) }).then((x) => x.json());
    setTracking(false);
    setTrackMsg(r.ok ? r.output : `⚠️ ${r.error}`);
  }

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dossier?apn=${encodeURIComponent(apn)}`)
      .then((r) => r.json()).then((j) => setD(j)).finally(() => setLoading(false));
  }, [apn]);

  const components = (d?.components ?? {}) as Record<string, { weight: number; weighted: number }>;
  const financing = (d?.financing ?? {}) as { recommended?: Array<{ structure?: string; sellerPitch?: string; legalGuardrail?: string }> };
  const top = financing.recommended?.[0];
  const gateFailures = (d?.gate_failures ?? []) as string[];

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

          {top && (
            <Section title="Financing">
              <div><strong>{String(top.structure ?? "cash").replace(/_/g, " ")}</strong></div>
              {top.sellerPitch && <div className="muted" style={{ marginTop: 4 }}>{top.sellerPitch}</div>}
              {top.legalGuardrail && <div style={{ marginTop: 6, fontSize: 12, color: "#7c2d12" }}>⚖️ {top.legalGuardrail}</div>}
            </Section>
          )}
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
