"use client";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Map, { Source, Layer, type MapLayerMouseEvent, type MapRef } from "react-map-gl";
import type { GeoJSONSource } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Icon from "../components/Icon";
import AsyncState from "../components/AsyncState";
import { useWorkspace } from "../components/WorkspaceShell";
import { useResource } from "../lib/useResource";
import { displayParcels, humanize, median, lensLegend, LENSES, type ParcelCollection, type ParcelFeature, type ParcelSort, type QuickFilter } from "../lib/propertyPresentation";
import { Score, tierOf, usd, pct } from "../ui";
import DealPanel from "../DealPanel";

const CENTER = { longitude: -78.5036, latitude: 38.0356, zoom: 12.4 };
const PAGE_SIZE = 30;
const RAMP = { strong: "#89bb9b", moderate: "#cba56b", weak: "#b87573" };
const QUICK: Array<[QuickFilter, string]> = [["all", "All properties"], ["strong", "Strong fit"], ["affordable", "Value up to $500k"], ["byRoom", "By-room permitted"], ["distress", "Distress signals"], ["review", "Needs review"]];
const EMPTY: ParcelFeature[] = [];
type View = "split" | "list" | "map";

export default function MapClient({ token }: { token: string | undefined }) {
  const { market } = useWorkspace();
  const searchParams = useSearchParams();
  const mapRef = useRef<MapRef>(null);
  const [selection, setSelection] = useState<string | null | undefined>(undefined);
  const selectedApn = selection === undefined ? searchParams.get("apn") : selection;
  const [view, setView] = useState<View>(token ? "split" : "list");
  const [query, setQuery] = useState("");
  const [quick, setQuick] = useState<QuickFilter>("all");
  const [sort, setSort] = useState<ParcelSort>("score");
  const [page, setPage] = useState(1);
  const [lens, setLens] = useState("score");
  const [developOnly, setDevelopOnly] = useState(false);
  const [showGrowth, setShowGrowth] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [filterQs, setFilterQs] = useState("");
  const [filterMsg, setFilterMsg] = useState<string | null>(null);
  const [filterBusy, setFilterBusy] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [mapRevision, setMapRevision] = useState(0);
  const dataUrl = `/api/parcels?lens=${lens}${filterQs ? `&${filterQs}` : ""}${developOnly ? "&developOnly=true" : ""}`;
  const parcels = useResource<ParcelCollection>(dataUrl);
  const growth = useResource<{ cells: Array<{ lat: number; lng: number; corridorScore: number }> }>(showGrowth ? "/api/growth" : null);
  const features = parcels.data?.features ?? EMPTY;
  const results = useMemo(() => displayParcels(features, query, quick, sort), [features, query, quick, sort]);
  const fc = useMemo<ParcelCollection>(() => ({ type: "FeatureCollection", features: results }), [results]);
  const growthFc = useMemo(() => ({ type: "FeatureCollection" as const, features: (growth.data?.cells ?? []).filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lng)).map(c => ({ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] }, properties: { score: c.corridorScore } })) }), [growth.data]);
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const shown = results.slice(start, start + PAGE_SIZE);
  const medianReturn = useMemo(() => median(results.map(f => f.properties.bestUseCoc ?? f.properties.coc)), [results]);
  const legend = lensLegend(lens);

  function select(feature: ParcelFeature) {
    setSelection(feature.properties.apn);
    mapRef.current?.flyTo({ center: feature.geometry.coordinates, zoom: Math.max(14, mapRef.current.getZoom()), duration: 500 });
  }
  const onMapClick = useCallback((event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature) return;
    if (feature.properties?.cluster_id != null && feature.geometry.type === "Point") {
      const coordinates = feature.geometry.coordinates as [number, number];
      const source = mapRef.current?.getSource("parcels-src") as GeoJSONSource | undefined;
      source?.getClusterExpansionZoom(Number(feature.properties.cluster_id), (error, zoom) => {
        if (!error && zoom != null) mapRef.current?.easeTo({ center: coordinates, zoom, duration: 450 });
      });
    } else if (feature.properties?.apn) setSelection(String(feature.properties.apn));
  }, []);
  function fitResults() {
    if (!results.length) return;
    const coordinates = results.map(f => f.geometry.coordinates);
    const lngs = coordinates.map(c => c[0]), lats = coordinates.map(c => c[1]);
    mapRef.current?.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 80, maxZoom: 15, duration: 600 });
  }
  async function applyFilter(event: React.FormEvent) {
    event.preventDefault();
    if (!aiPrompt.trim() || filterBusy) return;
    setFilterBusy(true); setFilterMsg(null);
    try {
      const response = await fetch("/api/filter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: aiPrompt }), signal: AbortSignal.timeout(45000) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error("filter unavailable");
      const allowed = new Set(["minScore", "maxPrice", "minBeds", "maxDistanceMiles", "byRoomLegalOnly", "absenteeOnly", "distressOnly"]);
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(result.filter ?? {})) if (allowed.has(key) && value != null) params.set(key, String(value));
      setFilterQs(params.toString()); setPage(1);
      setFilterMsg(params.size ? `Applied: ${[...params.entries()].map(([key, value]) => `${key}: ${value}`).join("; ")}` : "No supported filters were found. Try a price, bed count, or absentee-owner requirement.");
    } catch {
      setFilterMsg("The AI filter could not complete. Check your AI connection in Settings, or use the address search and quick filters above. Your previous results have been kept.");
    } finally { setFilterBusy(false); }
  }
  function clearFilters() { setQuery(""); setQuick("all"); setFilterQs(""); setAiPrompt(""); setFilterMsg(null); setDevelopOnly(false); setPage(1); }
  const hasFilters = !!query || quick !== "all" || !!filterQs || developOnly;
  const paging = <div className="results-pagination"><span>{results.length ? `${start + 1}-${Math.min(start + PAGE_SIZE, results.length)} of ${results.length.toLocaleString()}` : "0 properties"}</span><div><button className="icon-button" aria-label="Previous results" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><Icon name="left" size={13} /></button><button className="icon-button" aria-label="Next results" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}><Icon name="right" size={13} /></button></div></div>;
  const unavailable = parcels.loading ? <AsyncState loading title="Loading property data" description="Your list and map use the same scored records." /> : parcels.error ? <AsyncState error title="Properties could not be loaded" description={parcels.error} retry={parcels.reload} /> : !results.length ? <AsyncState title={hasFilters ? "No properties match these filters" : "Your market is ready for its first refresh"} description={hasFilters ? "Try a different address or remove a filter to widen your search." : "Load parcel data using the self-hosting quick start. No AI key is required to browse the results."} action={hasFilters ? undefined : { href: "/settings", label: "Open setup & data" }} retry={hasFilters ? clearFilters : undefined} /> : null;

  return <div className="explorer">
    <div className="explorer-header"><div className="page-heading"><div><div className="page-eyebrow">{market} / Property research</div><h1>Find the properties worth a closer look.</h1><p>A shared view of thesis fit, estimated returns, and the constraints behind them.</p></div><Link href="/thesis" className="btn"><Icon name="target" size={14} />Investment thesis</Link></div>
      <div className="explorer-toolbar"><label className="explorer-search"><Icon name="search" size={16} /><input type="search" aria-label="Search properties by address or parcel ID" placeholder="Search an address or parcel ID..." value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} /></label><select className="explorer-select" aria-label="Sort properties" value={sort} onChange={e => { setSort(e.target.value as ParcelSort); setPage(1); }}><option value="score">Highest thesis fit</option><option value="return">Highest modeled return</option><option value="value">Lowest estimated value</option></select><div className="segmented" role="group" aria-label="Property view">{(["list", "split", "map"] as View[]).map(mode => <button key={mode} aria-pressed={view === mode} disabled={!token && mode !== "list"} title={!token && mode !== "list" ? "Connect Mapbox to enable this view" : undefined} onClick={() => setView(mode)}><Icon name={mode} size={13} />{humanize(mode)}</button>)}</div></div>
      <div className="filter-strip">{QUICK.map(([key, label]) => <button className="filter-pill" key={key} aria-pressed={quick === key} onClick={() => { setQuick(key); setPage(1); }}>{key === "strong" && <Icon name="target" size={11} />}{label}</button>)}<button className="filter-pill" aria-pressed={developOnly} onClick={() => { setDevelopOnly(!developOnly); setPage(1); }}>Development upside</button><button className="filter-pill filter-ai" aria-expanded={aiOpen} aria-controls="ai-property-filter" onClick={() => setAiOpen(!aiOpen)}><Icon name="sparkles" size={12} />AI filter{filterQs ? " (active)" : ""}</button></div>
      {aiOpen && <section id="ai-property-filter" className="ai-filter-panel"><form onSubmit={applyFilter}><input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} aria-label="Describe an AI property filter" placeholder="For example: absentee owners under $400k with at least 3 beds" maxLength={1500} /><button className="btn-primary" disabled={filterBusy || !aiPrompt.trim()}>{filterBusy ? "Applying..." : "Apply filter"}</button>{filterQs && <button type="button" className="btn" onClick={() => { setFilterQs(""); setFilterMsg(null); setPage(1); }}>Remove AI filter</button>}</form><p>Uses your configured AI provider. Address search and the quick filters work without AI.</p>{filterMsg && <p className="filter-message" role="status">{filterMsg}</p>}</section>}
    </div>
    {!token && <div className="explorer-notice"><div className="inline-notice"><Icon name="map" size={16} /><span><strong>The property list works without a map token.</strong> To add the map, set NEXT_PUBLIC_MAPBOX_TOKEN in your .env and restart. <Link href="/settings">Setup & data</Link></span></div></div>}
    <div className="explorer-summary" aria-live="polite"><div className="summary-values"><span><strong>{parcels.loading ? "..." : parcels.error ? "Unavailable" : results.length.toLocaleString()}</strong> properties</span><span>Median modeled CoC <strong>{parcels.loading || parcels.error ? "-" : pct(medianReturn)}</strong></span><span>Sorted by {sort === "score" ? "thesis fit" : sort === "value" ? "estimated value" : "modeled return"}</span></div>{hasFilters && <button className="btn-ghost btn-sm" onClick={clearFilters}>Clear all filters<Icon name="close" size={11} /></button>}</div>
    <div className={`explorer-body mode-${view}`}>
      {view !== "map" && <section className={view === "split" ? "explorer-results" : "explorer-list-view"} aria-label="Property results" aria-busy={parcels.loading}>
        {unavailable ?? (view === "split" ? <div className="results-list">{shown.map(feature => { const p = feature.properties; return <button key={p.apn} className="result-card" onClick={() => select(feature)} aria-pressed={selectedApn === p.apn}><div className="result-card-top"><h2>{p.address ?? "Address unavailable"}</h2><Score value={Math.round(p.score)} tier={tierOf(p.score)} /></div><div className="result-id">PARCEL {p.apn}</div><div className="result-card-metrics"><div><strong>{usd(p.price)}</strong><small>Estimated value</small></div><div><strong>{pct(p.bestUseCoc ?? p.coc)}</strong><small>Modeled CoC</small></div></div><div className="result-card-tags"><span>{humanize(p.use)}</span>{!p.gatePassed && <span className="needs-review">Constraint review</span>}{p.distress && <span>Distress signal</span>}</div></button>; })}</div> : <div className="tablewrap"><table><thead><tr><th>Property</th><th>Recommended use</th><th className="numeric">Estimated value</th><th className="numeric">Modeled CoC</th><th>Screening</th><th className="numeric">Thesis fit</th></tr></thead><tbody>{shown.map(feature => { const p = feature.properties; return <tr key={p.apn} className={selectedApn === p.apn ? "is-selected" : ""}><td><button className="property-link" onClick={() => select(feature)}>{p.address ?? "Address unavailable"}</button><span className="property-meta">{p.apn}</span></td><td>{humanize(p.use)}<span className="property-meta">{humanize(p.structure)}</span></td><td className="numeric">{usd(p.price)}</td><td className="numeric">{pct(p.bestUseCoc ?? p.coc)}</td><td><span className={`screening-label ${p.gatePassed ? "is-pass" : "is-review"}`}><Icon name={p.gatePassed ? "check" : "warning"} size={11} />{p.gatePassed ? "Passed gates" : "Needs review"}</span></td><td className="numeric"><Score value={Math.round(p.score)} tier={tierOf(p.score)} /></td></tr>; })}</tbody></table></div>)}
        {!unavailable && paging}
      </section>}
      {view !== "list" && token && <section className="explorer-map" aria-label="Interactive property map">
        {parcels.error || mapError ? <div className="map-error"><AsyncState error title={mapError ? "The basemap could not load" : "Property data is unavailable"} description={mapError ? "Check the Mapbox token and network connection. Your property list is still available." : "Retry your data connection or return to the list."} retry={() => { parcels.reload(); setMapError(false); setMapRevision(value => value + 1); }} /><button className="btn map-return-list" onClick={() => setView("list")}>Use property list</button></div> : <Map key={mapRevision} ref={mapRef} mapboxAccessToken={token} initialViewState={CENTER} mapStyle="mapbox://styles/mapbox/dark-v11" interactiveLayerIds={["parcels", "parcel-clusters"]} onClick={onMapClick} onError={() => setMapError(true)} cursor="pointer" style={{ width: "100%", height: "100%", minHeight: 520 }}>
          {showGrowth && <Source id="growth-src" type="geojson" data={growthFc}><Layer id="growth-heat" type="heatmap" paint={{ "heatmap-weight": ["interpolate", ["linear"], ["get", "score"], 0, 0, 100, 1], "heatmap-intensity": .9, "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 11, 20, 15, 45], "heatmap-opacity": .4, "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", .35, "#253f44", .65, "#698b88", 1, "#d5e2b4"] }} /></Source>}
          <Source id="parcels-src" type="geojson" data={fc} cluster clusterMaxZoom={13} clusterRadius={35}>
            <Layer id="parcel-clusters" type="circle" filter={["has", "point_count"]} paint={{ "circle-color": "#25342d", "circle-stroke-color": "#789782", "circle-stroke-width": 1, "circle-radius": ["step", ["get", "point_count"], 17, 50, 22, 500, 28] }} />
            <Layer id="parcel-cluster-count" type="symbol" filter={["has", "point_count"]} layout={{ "text-field": "{point_count_abbreviated}", "text-size": 11 }} paint={{ "text-color": "#e8efe8" }} />
            <Layer id="parcels" type="circle" filter={["!", ["has", "point_count"]]} paint={{ "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3, 16, 6], "circle-color": ["step", ["get", "colorValue"], RAMP.weak, 50, RAMP.moderate, 70, RAMP.strong], "circle-opacity": .85, "circle-stroke-width": ["case", ["==", ["get", "apn"], selectedApn ?? ""], 3, ["==", ["get", "gatePassed"], false], 1.25, .5], "circle-stroke-color": ["case", ["==", ["get", "apn"], selectedApn ?? ""], "#f1f4ea", ["==", ["get", "gatePassed"], false], "#e7bd77", "#111714"] }} />
          </Source>
        </Map>}
        {!mapError && !parcels.error && <><div className="map-tools"><label>COLOR BY<select aria-label="Map color metric" value={lens} onChange={e => setLens(e.target.value)}>{LENSES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><div className="map-tool-group"><button className="icon-button" aria-label="Fit all filtered properties" disabled={!results.length} onClick={fitResults} title="Fit filtered properties"><Icon name="location" size={16} /></button><button className="icon-button" aria-label="Map layers" aria-expanded={layersOpen} onClick={() => setLayersOpen(!layersOpen)}><Icon name="layers" size={16} /></button></div></div>{layersOpen && <div className="map-layers"><h3>Map layers</h3><label><input type="checkbox" checked={showGrowth} onChange={e => setShowGrowth(e.target.checked)} />Growth corridors</label><p>A positioning signal from the growth model, not a forecast of property value.</p>{growth.loading && <p role="status">Loading corridor data...</p>}{growth.error && <p role="alert">Corridor data unavailable. <button className="text-action" onClick={growth.reload}>Retry</button></p>}<p>Amber outlines flag failed screening gates. Open a property to read the constraint.</p></div>}<div className="map-legend"><strong>{legend.title}</strong><div className="row"><span className="dotc" style={{ background: RAMP.strong }} />{legend.strong}</div><div className="row"><span className="dotc" style={{ background: RAMP.moderate }} />{legend.moderate}</div><div className="row"><span className="dotc" style={{ background: RAMP.weak }} />{legend.weak}</div><div style={{ marginTop: 8 }}>{legend.unit}</div></div>{parcels.loading && <div className="map-loading" role="status">Updating property data...</div>}{!parcels.loading && !results.length && <div className="map-empty-notice">No properties match the current view. Try clearing the filters.</div>}</>}
      </section>}
    </div>
    <div className="explorer-caveat">Estimated values are not asking prices. Returns and recommended uses are modeled screening outputs. Validate source records, zoning, and financing with qualified professionals.</div>
    {selectedApn && <DealPanel key={selectedApn} apn={selectedApn} onClose={() => setSelection(null)} />}
  </div>;
}
