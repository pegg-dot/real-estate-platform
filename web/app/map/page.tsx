import MapClient from "./MapClient";

// The token is resolved at REQUEST time on the server and handed to the client map as a prop, so a
// self-hoster can set NEXT_PUBLIC_MAPBOX_TOKEN in .env after the image is built (Docker, Railway,
// Render) and get a map on the next restart — no rebuild. Next inlines `process.env.NEXT_PUBLIC_*`
// member expressions at build time, which is exactly what we must avoid here; reading through an
// alias keeps it a real runtime lookup. (It's a public Mapbox token; it was always sent to the browser.)
export const dynamic = "force-dynamic";

export default function MapPage() {
  const env = process.env as Record<string, string | undefined>;
  return <MapClient token={env.NEXT_PUBLIC_MAPBOX_TOKEN || env.MAPBOX_TOKEN} />;
}
