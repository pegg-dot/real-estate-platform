"use client";
import { useState, useCallback } from "react";
import Map, { Source, Layer, type MapLayerMouseEvent } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import DealPanel from "../DealPanel";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const scorePaint = {
  "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 2.5, 15, 6] as unknown as number,
  "circle-color": [
    "interpolate", ["linear"], ["get", "colorValue"],
    35, "#dc2626", 50, "#f59e0b", 62, "#84cc16", 74, "#16a34a",
  ] as unknown as string,
  "circle-opacity": 0.82,
  "circle-stroke-width": ["case", ["==", ["get", "gatePassed"], false], 1.5, 0] as unknown as number,
  "circle-stroke-color": "#92400e",
};

export default function MapPage() {
  const [selectedApn, setSelectedApn] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterQs, setFilterQs] = useState("");
  const [lens, setLens] = useState("best_use");   // default = use-neutral (spec 021)
  const [filterMsg, setFilterMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dataUrl = `/api/parcels?${filterQs ? filterQs + "&" : ""}lens=${lens}`;

  const onClick = useCallback((e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (f?.properties?.apn) setSelectedApn(String(f.properties.apn));
  }, []);

  async function applyFilter(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true); setFilterMsg(null);
    const r = await fetch("/api/filter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: query }) }).then((x) => x.json());
    setBusy(false);
    if (!r.ok) { setFilterMsg(`⚠️ ${r.error}`); return; }
    const f = r.filter as Record<string, unknown>;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v != null) params.set(k, String(v));
    setFilterQs(params.toString());
    const applied = Object.entries(f).filter(([, v]) => v != null).map(([k, v]) => `${k}=${v}`);
    setFilterMsg(applied.length ? `Filtered: ${applied.join(", ")}` : "No filters parsed from that.");
  }
  function clearFilter() { setFilterQs(""); setQuery(""); setFilterMsg(null); }

  if (!TOKEN) {
    return <div className="page"><h2>Map needs a Mapbox token</h2>
      <p className="muted">Set <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in the repo .env and restart.</p></div>;
  }

  return (
    <div style={{ position: "relative", height: "calc(100vh - 44px)" }}>
      <Map
        mapboxAccessToken={TOKEN}
        initialViewState={{ longitude: -78.5036, latitude: 38.0356, zoom: 12.4 }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        interactiveLayerIds={["parcels"]}
        onClick={onClick}
        cursor="pointer"
      >
        <Source id="parcels-src" type="geojson" data={dataUrl}>
          <Layer id="parcels" type="circle" paint={scorePaint as never} />
        </Source>
      </Map>

      <div style={{ position: "absolute", top: 12, left: 12, width: 440, background: "#fff", padding: "10px 12px",
        borderRadius: 8, boxShadow: "0 1px 8px rgba(0,0,0,0.18)", fontSize: 13 }}>
        <strong>Map</strong> — every scored parcel, red→green by the selected lens. Click a dot for the deal.
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 12 }}>Color by: </label>
          <select value={lens} onChange={(e) => setLens(e.target.value)} style={{ fontSize: 12, padding: "3px 6px", borderRadius: 5, border: "1px solid #cbd5e1" }}>
            <option value="best_use">Best legal use (CoC)</option>
            <option value="cash_flow">Cash flow (best CoC)</option>
            <option value="appreciation">Appreciation</option>
            <option value="by_room">By-the-room (CoC)</option>
            <option value="score">Thesis score</option>
          </select>
          <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>default = best use (use-neutral)</span>
        </div>
        <form onSubmit={applyFilter} style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder='Filter in plain English: "by-room legal under $400k within 1mi, neglected"'
            style={{ flex: 1, padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12 }} />
          <button type="submit" disabled={busy} style={{ padding: "6px 10px", border: "1px solid #0f172a", background: "#0f172a", color: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>{busy ? "…" : "Filter"}</button>
          {filterQs !== "" && <button type="button" onClick={clearFilter} style={{ padding: "6px 8px", border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Clear</button>}
        </form>
        {filterMsg && <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>{filterMsg}</div>}
        <div className="muted" style={{ marginTop: 6, fontSize: 11 }}>Want to <em>ask</em> instead of filter? Use <a href="/ask">Ask LOT</a>.</div>
      </div>

      {selectedApn && <DealPanel apn={selectedApn} onClose={() => setSelectedApn(null)} />}
    </div>
  );
}
