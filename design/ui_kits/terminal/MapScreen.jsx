/* LOT terminal — Map screen: dark Leaflet (2D) + Google Photorealistic 3D Tiles (3D),
   left rail (command search · layers · automations · ranked list), right deal drawer. */
const { useState: useS, useEffect: useE, useRef: useR } = React;

const TIER_SOLID = { strong: "#6dab5f", moderate: "#d39a4e", weak: "#d4634a" };

function MapScreen({ selected, setSelected, tracked, onTrack, onAsk }) {
  const D = window.LOT_DATA;
  const [view, setView] = useS("2d");
  const [layers, setLayers] = useS({ deals: true, zone: true, heat: false });
  const [query, setQuery] = useS("");
  const [token, setToken] = useS(typeof localStorage !== "undefined" ? localStorage.getItem("lot_gkey") || "" : "");
  const [tokenInput, setTokenInput] = useS("");
  const mapRef = useR(null), leafRef = useR(null), realRef = useR(null);

  // ---- 2D Leaflet ----
  useE(() => {
    if (view !== "2d" || !mapRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView(D.center, D.zoom);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 20, subdomains: "abcd" }).addTo(map);
    leafRef.current = map;
    // vector street + parcel underlay (reads detailed with or without tiles)
    const streets = [
      [[38.0401, -78.4915], [38.0398, -78.4982]], // Grady Ave
      [[38.0392, -78.4915], [38.0389, -78.4988]], // Gordon Ave
      [[38.0347, -78.4960], [38.0343, -78.4995]], // Wertland St
      [[38.0342, -78.4972], [38.0406, -78.4966]], // 14th St
      [[38.0339, -78.4938], [38.0403, -78.4932]], // 15th St
      [[38.0345, -78.5005], [38.0408, -78.4998]], // JPA
    ];
    streets.forEach((s) => {
      L.polyline(s, { color: "#3a352f", weight: 7, opacity: 0.5, lineCap: "round" }).addTo(map);
      L.polyline(s, { color: "#4a443c", weight: 1, opacity: 0.5, dashArray: "1 9", lineCap: "round" }).addTo(map);
    });
    D.parcels.forEach((p) => {
      const d = 0.00045;
      L.rectangle([[p.lat - d, p.lng - d], [p.lat + d, p.lng + d]],
        { color: TIER_SOLID[p.tier], weight: 1, opacity: 0.5, fillColor: TIER_SOLID[p.tier], fillOpacity: 0.12 }).addTo(map);
    });
    const groups = {};
    groups.zone = L.polygon(D.zone, { color: "#6dab5f", weight: 1.5, dashArray: "5", fillColor: "#6dab5f", fillOpacity: 0.08 });
    groups.heat = L.layerGroup([
      L.circle(D.uva, { radius: 320, stroke: false, fillColor: "#d4634a", fillOpacity: 0.16 }),
      L.circle([38.0388, -78.4955], { radius: 260, stroke: false, fillColor: "#d39a4e", fillOpacity: 0.12 }),
    ]);
    // UVA landmark
    L.marker(D.uva, { icon: L.divIcon({ className: "", html: `<div style="background:rgba(20,19,16,.82);border:1px solid #7b93b8;color:#9fb4d4;font-size:10px;font-family:ui-monospace,monospace;padding:3px 8px;border-radius:999px;white-space:nowrap;backdrop-filter:blur(6px)">◎ UVA grounds</div>`, iconSize: [110, 22], iconAnchor: [55, 11] }) }).addTo(map);
    groups.deals = L.layerGroup();
    D.parcels.forEach((p) => {
      const icon = L.divIcon({ className: "", html: `<div class="pin ${p.tier}"><span>${p.score}</span></div>`, iconSize: [28, 28], iconAnchor: [14, 28] });
      const m = L.marker([p.lat, p.lng], { icon }).addTo(groups.deals);
      m.on("click", () => setSelected(p));
    });
    Object.entries(layers).forEach(([k, on]) => { if (on) groups[k].addTo(map); });
    leafRef.current._groups = groups;
    return () => { map.remove(); leafRef.current = null; };
  }, [view]);

  // react to layer toggles (2D)
  useE(() => {
    const map = leafRef.current; if (!map || !map._groups) return;
    Object.entries(layers).forEach(([k, on]) => {
      const g = map._groups[k]; if (!g) return;
      if (on && !map.hasLayer(g)) g.addTo(map);
      if (!on && map.hasLayer(g)) map.removeLayer(g);
    });
  }, [layers]);

  // fly to selected (2D)
  useE(() => { if (view === "2d" && leafRef.current && selected) leafRef.current.flyTo([selected.lat, selected.lng], 17, { duration: 0.8 }); }, [selected, view]);

  // (Stylized Three.js 3D was removed — the "3D" view now streams Google Photorealistic 3D Tiles below.)

  // ---- Real 3D (Google Photorealistic 3D Tiles; needs a Maps API key) ----
  useE(() => {
    if (view !== "real" || !realRef.current || !token) return;
    const host = realRef.current; let map3d, cancelled = false;
    const loadScript = () => new Promise((res, rej) => {
      if (window.google && window.google.maps && window.google.maps.importLibrary) return res();
      const ex = document.getElementById("gmaps3d");
      if (ex) { ex.addEventListener("load", () => res()); ex.addEventListener("error", rej); return; }
      const s = document.createElement("script"); s.id = "gmaps3d"; s.async = true;
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(token)}&v=alpha`;
      s.onload = () => res(); s.onerror = rej; document.head.appendChild(s);
    });
    (async () => {
      try {
        await loadScript();
        const { Map3DElement, Marker3DElement } = await google.maps.importLibrary("maps3d");
        if (cancelled) return;
        map3d = new Map3DElement({ center: { lat: D.center[0], lng: D.center[1], altitude: 230 }, range: 1500, tilt: 66, heading: 18 });
        map3d.style.width = "100%"; map3d.style.height = "100%";
        host.appendChild(map3d);
        D.parcels.forEach((p) => {
          const mk = new Marker3DElement({ position: { lat: p.lat, lng: p.lng, altitude: 26 }, altitudeMode: "RELATIVE_TO_GROUND", extruded: true, label: String(p.score) });
          mk.addEventListener("gmp-click", () => setSelected(p));
          map3d.append(mk);
        });
        realRef.current._map = map3d;
      } catch (e) { /* bad key / load fail — overlay stays */ }
    })();
    return () => { cancelled = true; if (map3d && map3d.remove) map3d.remove(); };
  }, [view, token]);

  const saveToken = () => { const t = tokenInput.trim(); if (!t) return; try { localStorage.setItem("lot_gkey", t); } catch (e) {} setToken(t); };

  const sorted = [...D.parcels].sort((a, b) => b.score - a.score);

  return (
    <div className="map-wrap">
      <div className="map-side">
        <div className="search">
          <i className="ti ti-search" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="4+ beds · walk to UVA · by-room legal…" />
          <span className="kbd">⌘K</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Chip kind="info">thesis · {D.thesis}</Chip>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Tile k="Matches" v={D.stats.matches} />
          <Tile k="Median CoC" v={D.stats.medianCoc} />
          <Tile k="By-room" v={D.stats.byRoomLegal} />
        </div>

        <div className="card">
          <h3><i className="ti ti-stack-2" /> Layers</h3>
          {[["deals", "Scored parcels", "var(--score-strong)"], ["zone", "By-room legal zone", "var(--positive)"], ["heat", "Demand heat (campus)", "var(--warn)"]].map(([k, label, c]) => (
            <div className="lyr" key={k}>
              <span className="lk"><span className="dotc" style={{ background: c }} /> {label}</span>
              <Toggle on={layers[k]} onClick={() => setLayers((s) => ({ ...s, [k]: !s[k] }))} />
            </div>
          ))}
          <div className="lyr dim"><span className="lk"><span className="dotc" style={{ background: "var(--landmark)" }} /> Off-market leads</span><span className="mono" style={{ fontSize: 10 }}>pending</span></div>
        </div>

        <div className="card">
          <h3><i className="ti ti-robot" /> Automations</h3>
          <div className="lyr"><span className="lk">Weekly data refresh</span><Toggle on onClick={() => {}} /></div>
          <div className="lyr"><span className="lk">New-distress alerts</span><Toggle on onClick={() => {}} /></div>
          <Eyebrow style={{ marginTop: 8 }}>What changed this week</Eyebrow>
          {D.changes.slice(0, 3).map((c, i) => (
            <div className="feed" key={i}><i className={`ti ${c.icon}`} style={{ color: c.color, marginTop: 1 }} /><span>{c.txt}</span></div>
          ))}
        </div>

        <div className="card">
          <h3><i className="ti ti-list" /> Top matches</h3>
          {sorted.slice(0, 6).map((p, i) => (
            <div key={p.apn} className={`deal-row${selected && selected.apn === p.apn ? " sel" : ""}`} onClick={() => setSelected(p)}>
              <span className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)", width: 18 }}>#{i + 1}</span>
              <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600 }}>{p.address}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--text-secondary)" }}>{usd(p.price)} · {p.coc}% · {p.zone}</div></div>
              <Score value={p.score} tier={p.tier} />
            </div>
          ))}
        </div>
      </div>

      <div className="map-main">
        <div className="viewtoggle">
          <button className={view === "2d" ? "active" : ""} onClick={() => setView("2d")}><i className="ti ti-map" /> 2D map</button>
          <button className={view === "real" ? "active" : ""} onClick={() => setView("real")}><i className="ti ti-building-skyscraper" /> 3D</button>
        </div>
        <div className="map-controls">
          <button className="mc-btn" title="Recenter" onClick={() => view === "2d" && leafRef.current && leafRef.current.flyTo(D.center, D.zoom)}><i className="ti ti-current-location" /></button>
          <button className="mc-btn" title="Layers"><i className="ti ti-stack-2" /></button>
        </div>
        <div className="map-legend">
          <div className="row"><span className="dotc" style={{ background: "var(--score-strong)" }} /> strong ≥70</div>
          <div className="row"><span className="dotc" style={{ background: "var(--score-moderate)" }} /> moderate</div>
          <div className="row"><span className="dotc" style={{ background: "var(--score-weak)" }} /> weak &lt;50</div>
          <div className="row" style={{ marginTop: 4, color: "var(--text-tertiary)", fontSize: 10 }}>{view === "real" ? "Google photorealistic 3D · drag to fly" : "real geocoded parcels"}</div>
        </div>
        {view === "2d" && <div id="leaflet" ref={mapRef} />}
        {view === "real" && <div id="mapbox" ref={realRef} style={{ position: "absolute", inset: 0 }} />}
        {view === "real" && !token && (
          <div className="token-gate">
            <i className="ti ti-building-skyscraper" style={{ fontSize: 30, color: "var(--accent-bright)" }} />
            <div style={{ font: "var(--text-h2)" }}>Load real 3D buildings</div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 330, textAlign: "center", lineHeight: 1.55 }}>
              Real photorealistic geometry streams from <strong>Google Photorealistic 3D Tiles</strong>. Paste a <strong>Google Maps API key</strong> (Map Tiles + Maps JS enabled) to fly the actual Charlottesville skyline. Stored locally in your browser only.
            </p>
            <div className="search" style={{ width: 340 }}>
              <i className="ti ti-key" />
              <input value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="AIzaSy…" onKeyDown={(e) => e.key === "Enter" && saveToken()} />
            </div>
            <button className="btn-primary" onClick={saveToken}><i className="ti ti-cube" /> Render real 3D</button>
            <a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>Get a Google Maps key →</a>
          </div>
        )}
        <div className="map-attr">{view === "real" ? "© Google · Photorealistic 3D Tiles" : "© OpenStreetMap · CARTO"}</div>
      </div>

      {selected && <DealDrawer parcel={selected} onClose={() => setSelected(null)} onTrack={onTrack} tracked={tracked.includes(selected.apn)} onAsk={onAsk} />}
    </div>
  );
}
window.MapScreen = MapScreen;
