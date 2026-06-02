"use client";
import { useState, useCallback } from "react";
import Map, { Source, Layer, type MapLayerMouseEvent } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import DealPanel from "./DealPanel";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// circle color ramp by score: red (low) → amber → green (high)
const scorePaint = {
  "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 2.5, 15, 6] as unknown as number,
  "circle-color": [
    "interpolate", ["linear"], ["get", "score"],
    40, "#dc2626", 55, "#f59e0b", 70, "#84cc16", 85, "#16a34a",
  ] as unknown as string,
  "circle-opacity": 0.82,
  "circle-stroke-width": ["case", ["==", ["get", "gatePassed"], false], 1.5, 0] as unknown as number,
  "circle-stroke-color": "#92400e",
};

export default function MapPage() {
  const [selectedApn, setSelectedApn] = useState<string | null>(null);

  const onClick = useCallback((e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (f?.properties?.apn) setSelectedApn(String(f.properties.apn));
  }, []);

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
        <Source id="parcels-src" type="geojson" data="/api/parcels">
          <Layer id="parcels" type="circle" paint={scorePaint as never} />
        </Source>
      </Map>

      <div style={{ position: "absolute", top: 12, left: 12, background: "#fff", padding: "8px 12px",
        borderRadius: 8, boxShadow: "0 1px 6px rgba(0,0,0,0.15)", fontSize: 13 }}>
        <strong>Deal map</strong> — every scored parcel, colored by thesis score.<br />
        <span className="muted">🔴 low · 🟡 ~55 · 🟢 high · ⌬ outline = trips a constraint. Click a dot.</span>
      </div>

      {selectedApn && <DealPanel apn={selectedApn} onClose={() => setSelectedApn(null)} />}
    </div>
  );
}
