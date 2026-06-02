"use client";
import { useEffect, useState } from "react";

interface Comp { address: string | null; beds: number | null; rent_monthly: string | null; per_bed_rent: string | null; is_by_room: boolean; source: string; observed_at: string | null }

export default function RentsPage() {
  const [comps, setComps] = useState<Comp[]>([]);
  const [f, setF] = useState({ address: "", lat: "", lng: "", beds: "", rent: "", byroom: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => fetch("/api/rents").then((r) => r.json()).then((j) => setComps(j.comps ?? []));
  useEffect(() => { load(); }, []);

  const [rc, setRc] = useState({ address: "", beds: "" });
  async function add() {
    setBusy(true); setMsg(null);
    const x = await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "add-rent-comp", address: f.address, lat: f.lat, lng: f.lng, beds: f.beds, rent: f.rent, byroom: f.byroom }) }).then((y) => y.json());
    setBusy(false); setMsg(x.ok ? x.output : `⚠️ ${x.error}`); if (x.ok) { load(); setF({ address: "", lat: "", lng: "", beds: "", rent: "", byroom: false }); }
  }
  async function fetchRentCast() {
    setBusy(true); setMsg(null);
    const x = await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "rentcast", address: rc.address, beds: rc.beds }) }).then((y) => y.json());
    setBusy(false); setMsg(x.ok ? x.output : `⚠️ ${x.error}`); if (x.ok) load();
  }

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Rents — real comps that override the modeled $/bed</h1>
      <p className="muted" style={{ marginBottom: 12 }}>Add a real rent you know; nearby parcels re-score off it (provenance flips to real, confidence lifts). RentCast needs a key in .env.</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <I v={f.address} set={(v) => setF({ ...f, address: v })} ph="address" w={160} />
        <I v={f.lat} set={(v) => setF({ ...f, lat: v })} ph="lat" w={80} />
        <I v={f.lng} set={(v) => setF({ ...f, lng: v })} ph="lng" w={80} />
        <I v={f.beds} set={(v) => setF({ ...f, beds: v })} ph="beds" w={60} />
        <I v={f.rent} set={(v) => setF({ ...f, rent: v })} ph="rent/mo" w={80} />
        <label style={{ fontSize: 12 }}><input type="checkbox" checked={f.byroom} onChange={(e) => setF({ ...f, byroom: e.target.checked })} /> per-room</label>
        <button onClick={add} disabled={busy} style={btn}>{busy ? "…" : "+ Add comp"}</button>
      </div>
      {msg && <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>{msg}</div>}

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 14 }}>
        <span className="muted" style={{ fontSize: 12 }}>or pull from RentCast:</span>
        <I v={rc.address} set={(v) => setRc({ ...rc, address: v })} ph="full address, City, VA" w={200} />
        <I v={rc.beds} set={(v) => setRc({ ...rc, beds: v })} ph="beds" w={60} />
        <button onClick={fetchRentCast} disabled={busy} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Fetch RentCast</button>
        <span className="muted" style={{ fontSize: 11 }}>(needs RENTCAST_API_KEY)</span>
      </div>

      <table><thead><tr><th>Address</th><th>Beds</th><th>Rent/mo</th><th>$/bed</th><th>Type</th><th>Source</th></tr></thead><tbody>
        {comps.map((c, i) => (<tr key={i}><td>{c.address ?? "—"}</td><td>{c.beds ?? "—"}</td><td>${Number(c.rent_monthly ?? 0).toLocaleString()}</td><td>${Number(c.per_bed_rent ?? 0).toLocaleString()}</td><td>{c.is_by_room ? "per-room" : "whole-unit"}</td><td className="muted">{c.source}</td></tr>))}
        {comps.length === 0 && <tr><td colSpan={6} className="muted">No real comps yet — add one above (or wire RentCast). Until then, rents are modeled (HUD-floored).</td></tr>}
      </tbody></table>
    </div>
  );
}
function I({ v, set, ph, w }: { v: string; set: (s: string) => void; ph: string; w: number }) {
  return <input value={v} onChange={(e) => set(e.target.value)} placeholder={ph} style={{ width: w, padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12 }} />;
}
const btn: React.CSSProperties = { padding: "6px 12px", border: "1px solid #0f172a", background: "#0f172a", color: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 };
