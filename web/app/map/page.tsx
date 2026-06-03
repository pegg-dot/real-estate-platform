"use client";
/* LOT — Map screen. Restyled to design/ui_kits/terminal/MapScreen.jsx (dark operational terminal:
   left command rail + dark vector map + floating chrome + right deal drawer).
   LOT-DECISION rule#1: the repo uses react-map-gl/Mapbox (data/behavior wins over the kit's Leaflet),
   so we keep Mapbox + ALL wiring (lens, NL filter /api/filter, /api/parcels GeoJSON, DealPanel) and
   restyle only the look. 3D (kit's Google Photorealistic Tiles) is NOT wired in this repo, so the
   3D toggle is omitted rather than faked. */
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Map, { Source, Layer, type MapLayerMouseEvent, type MapRef } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import DealPanel from "../DealPanel";
import { Score, Tile, Chip, Toggle, tierOf, usd } from "../ui";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const CENTER = { longitude: -78.5036, latitude: 38.0356, zoom: 12.4 };

// design score ramp (colors_and_type.css): weak <50 · moderate 50–69 · strong ≥70
const RAMP = { strong: "#6dab5f", moderate: "#d39a4e", weak: "#d4634a" };
const colorByValue = ["step", ["get", "colorValue"], RAMP.weak, 50, RAMP.moderate, 70, RAMP.strong] as unknown as string;

interface Feat {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    apn: string; address: string | null; score: number; colorValue: number; coc: number | null;
    bestUseCoc: number | null; byRoom: boolean | null; gatePassed: boolean;
    structure: string | null; use: string | null; distress: boolean; price?: number | null; zone?: string | null;
  };
}
const EMPTY = { type: "FeatureCollection" as const, features: [] as Feat[] };

const LENSES: Array<[string, string]> = [
  ["best_use", "Best legal use (CoC)"], ["cash_flow", "Cash flow (best CoC)"],
  ["appreciation", "Appreciation"], ["by_room", "By-the-room (CoC)"], ["score", "Thesis score"],
];

export default function MapPage() {
  const mapRef = useRef<MapRef | null>(null);
  const [selectedApn, setSelectedApn] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterQs, setFilterQs] = useState("");
  const [lens, setLens] = useState("best_use");          // default = use-neutral (spec 021)
  const [developOnly, setDevelopOnly] = useState(false); // the development-upside layer (spec 020)
  const [filterMsg, setFilterMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fc, setFc] = useState<typeof EMPTY>(EMPTY);
  const [changes, setChanges] = useState<Array<{ change_type: string; severity: string; address: string | null; apn: string }>>([]);

  const dataUrl = `/api/parcels?${filterQs ? filterQs + "&" : ""}lens=${lens}${developOnly ? "&developOnly=true" : ""}`;

  // one shared fetch feeds BOTH the map source and the left rail (stats + top matches).
  // AbortController so a fast lens/filter change can't let an earlier request paint stale data.
  useEffect(() => {
    const ac = new AbortController();
    fetch(dataUrl, { signal: ac.signal })
      .then((r) => r.json())
      .then((j) => setFc(j?.features ? j : EMPTY))
      .catch((e) => { if ((e as Error).name !== "AbortError") setFc(EMPTY); });
    return () => ac.abort();
  }, [dataUrl]);

  // the weekly Scout diff for the rail's "what changed" feed (the change-feed rail from the kit)
  useEffect(() => {
    let live = true;
    fetch("/api/changes").then((r) => r.json()).then((j) => { if (live) setChanges(j?.changes ?? []); }).catch(() => {});
    return () => { live = false; };
  }, []);

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

  // rail stats + ranked list, derived from the live features (no mock data)
  const { matches, medianCoc, byRoomCount, top } = useMemo(() => {
    const feats = fc.features;
    const cocs = feats.map((f) => f.properties.bestUseCoc ?? f.properties.coc).filter((c): c is number => c != null).sort((a, b) => a - b);
    const med = cocs.length ? cocs[Math.floor(cocs.length / 2)] : null;
    const sorted = [...feats].sort((a, b) => b.properties.score - a.properties.score).slice(0, 6);
    return {
      matches: feats.length,
      medianCoc: med != null ? `${(med * 100).toFixed(1)}%` : "—",
      byRoomCount: feats.filter((f) => f.properties.byRoom).length,
      top: sorted,
    };
  }, [fc]);

  const recenter = () => mapRef.current?.flyTo({ center: [CENTER.longitude, CENTER.latitude], zoom: CENTER.zoom, duration: 800 });

  if (!TOKEN) {
    return <div className="map-wrap"><div className="map-notice">
      <i className="ti ti-map-off" style={{ fontSize: 28, color: "var(--accent-bright)" }} />
      <div style={{ font: "var(--text-h2)", color: "var(--text-primary)" }}>Map needs a Mapbox token</div>
      <p style={{ maxWidth: 360 }}>Set <code className="mono">NEXT_PUBLIC_MAPBOX_TOKEN</code> in the repo .env and restart.</p>
    </div></div>;
  }

  return (
    <div className="map-wrap">
      {/* ---- left command rail ---- */}
      <aside className="map-side">
        <form className="search" onSubmit={applyFilter}>
          <i className="ti ti-search" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter parcels in plain English"
            placeholder='plain-English filter — "by-room legal under $400k, neglected"' />
          {busy ? <span className="kbd mono" style={{ fontSize: 10 }}>…</span>
            : filterQs ? <button type="button" className="btn-ghost btn-sm" onClick={clearFilter}>clear</button>
            : <span className="mono" style={{ fontSize: 10, color: "var(--text-tertiary)" }}>⏎</span>}
        </form>
        {filterMsg && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{filterMsg}</div>}
        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
          Want to <em>ask</em> instead of filter? Use <a href="/ask" style={{ color: "var(--accent-bright)" }}>Ask LOT</a>.
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Chip kind="info">thesis · UVA by-room</Chip>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Tile k="Matches" v={matches.toLocaleString()} />
          <Tile k="Median CoC" v={medianCoc} />
          <Tile k="By-room" v={byRoomCount.toLocaleString()} />
        </div>

        <div className="card">
          <h3><i className="ti ti-palette" /> Color by</h3>
          <select value={lens} onChange={(e) => setLens(e.target.value)}
            style={{ width: "100%", background: "var(--bg-panel-2)", color: "var(--text-primary)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", padding: "7px 9px", fontSize: 12, fontFamily: "var(--font-sans)" }}>
            {LENSES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <div style={{ marginTop: 4, fontSize: 10.5, color: "var(--text-tertiary)" }}>default = best legal use (use-neutral)</div>
          <div className="lyr" style={{ marginTop: 8 }}>
            <span className="lk"><span className="dotc" style={{ background: "var(--accent-bright)" }} /> Development upside only</span>
            <Toggle on={developOnly} onClick={() => setDevelopOnly((v) => !v)} />
          </div>
          <div className="lyr dim"><span className="lk"><span className="dotc" style={{ background: "var(--positive)" }} /> By-room legal zone</span><span className="mono" style={{ fontSize: 10 }}>pending</span></div>
          <div className="lyr dim"><span className="lk"><span className="dotc" style={{ background: "var(--landmark)" }} /> Off-market leads</span><span className="mono" style={{ fontSize: 10 }}>pending</span></div>
        </div>

        <div className="card">
          <h3><i className="ti ti-rss" /> What changed</h3>
          {changes.length === 0 && <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>No material changes since the last run.</div>}
          {changes.slice(0, 4).map((c, i) => (
            <div key={i} className="feed" style={i === 0 ? { borderTop: "none", paddingTop: 0 } : undefined}>
              <i className="ti ti-point-filled" style={{ color: c.severity === "high" ? "var(--critical)" : c.severity === "notable" ? "var(--warn)" : "var(--text-tertiary)", marginTop: 1 }} />
              <span>{(c.change_type ?? "").replace(/_/g, " ")} — {c.address ?? c.apn}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <h3><i className="ti ti-list" /> Top matches</h3>
          {top.length === 0 && <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>No parcels match the current filters.</div>}
          {top.map((f, i) => {
            const p = f.properties;
            return (
              <div key={p.apn} className={`deal-row${selectedApn === p.apn ? " sel" : ""}`}
                role="button" tabIndex={0} onClick={() => setSelectedApn(p.apn)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedApn(p.apn); } }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)", width: 18 }}>#{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.address ?? p.apn}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--text-secondary)" }}>
                    {p.price != null ? `${usd(p.price)} · ` : ""}{p.coc != null ? `${(p.coc * 100).toFixed(1)}% · ` : ""}{(p.use ?? p.structure ?? "—").replace(/_/g, " ")}
                  </div>
                </div>
                <Score value={p.score} tier={tierOf(p.score)} />
              </div>
            );
          })}
        </div>
      </aside>

      {/* ---- map ---- */}
      <div className="map-main">
        <div className="map-controls">
          <button className="mc-btn" title="Recenter on UVA grounds" onClick={recenter}><i className="ti ti-current-location" /></button>
        </div>
        <div className="map-legend">
          <div className="row"><span className="dotc" style={{ background: RAMP.strong }} /> strong ≥70</div>
          <div className="row"><span className="dotc" style={{ background: RAMP.moderate }} /> moderate</div>
          <div className="row"><span className="dotc" style={{ background: RAMP.weak }} /> weak &lt;50</div>
          <div className="row" style={{ marginTop: 4, color: "var(--text-tertiary)", fontSize: 10 }}>real geocoded parcels · {LENSES.find(([v]) => v === lens)?.[1].toLowerCase()}</div>
        </div>

        <Map
          ref={mapRef}
          mapboxAccessToken={TOKEN}
          initialViewState={CENTER}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          interactiveLayerIds={["parcels"]}
          onClick={onClick}
          cursor="pointer"
          attributionControl={false}
        >
          <Source id="parcels-src" type="geojson" data={fc}>
            {/* soft glow halo beneath the dot */}
            <Layer id="parcels-glow" type="circle" paint={{
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 6, 15, 16],
              "circle-color": colorByValue, "circle-opacity": 0.18, "circle-blur": 1,
            } as never} />
            {/* the parcel dot, colored by the selected lens; gate-failures get a warn ring, selected gets an ivory ring */}
            <Layer id="parcels" type="circle" paint={{
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3, 15, 7],
              "circle-color": colorByValue,
              "circle-opacity": 0.95,
              "circle-stroke-width": ["case", ["==", ["get", "apn"], selectedApn ?? ""], 3, ["==", ["get", "gatePassed"], false], 1.5, 0],
              "circle-stroke-color": ["case", ["==", ["get", "apn"], selectedApn ?? ""], "#f0ede6", "#d39a4e"],
            } as never} />
          </Source>
        </Map>
        <div className="map-attr">© Mapbox · © OpenStreetMap</div>
      </div>

      {selectedApn && <DealPanel apn={selectedApn} onClose={() => setSelectedApn(null)} />}
    </div>
  );
}
