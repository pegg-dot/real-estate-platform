"""Parcel-centroid geometry for the map (real lat/lng, bulk source).

The OpenData parcel layers are non-spatial, so coordinates come from the parcel polygons
in NDS_parcel_relate/MapServer/0 (cvgis.CITY.parcel_area), keyed by GPIN. We pull them in
one batched, injection-safe query and compute centroids here (pure). This is the always-on
base coordinate for every parcel; the address geocoder (geocode.py) is a precise override.

NOTE: GPIN is shared by condo units, so condo units resolve to the same parcel centroid —
fine for a map pin.
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request

PARCEL_LAYER = ("https://gisweb.charlottesville.org/arcgis/rest/services/"
                "NDS_parcel_relate/MapServer/0/query")


def _signed_area(ring: list) -> float:
    """Shoelace signed area; iterates with wrap-around so closed AND unclosed rings work."""
    n = len(ring)
    return 0.5 * sum(ring[i][0] * ring[(i + 1) % n][1] - ring[(i + 1) % n][0] * ring[i][1]
                     for i in range(n))


def polygon_centroid(ring: list) -> tuple[float, float]:
    """Area-weighted centroid of a polygon ring of [x=lng, y=lat] points. Returns (lat, lng).
    Robust to unclosed rings (wraps the last->first edge); falls back to the vertex average
    for a degenerate (zero-area) ring."""
    n = len(ring)
    a = cx = cy = 0.0
    for i in range(n):
        x0, y0 = ring[i]
        x1, y1 = ring[(i + 1) % n]
        cross = x0 * y1 - x1 * y0
        a += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    a *= 0.5
    if a == 0:                                    # degenerate — average the vertices
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return (sum(ys) / len(ys), sum(xs) / len(xs))
    return (cy / (6 * a), cx / (6 * a))           # (lat, lng)


def parse_parcel_features(response: dict) -> dict:
    """Parse a parcel_area query response into {gpin(str): (lat, lng)}.

    ArcGIS ring order isn't contractually outer-first, and a parcel may be multipart, so we
    pin to the centroid of the LARGEST-area ring (not rings[0]) — the dominant parcel piece.
    """
    out = {}
    for f in response.get("features", []):
        gpin = f.get("attributes", {}).get("GPIN")
        rings = (f.get("geometry") or {}).get("rings")
        if gpin is None or not rings:
            continue
        biggest = max(rings, key=lambda r: abs(_signed_area(r)))
        out[str(gpin)] = polygon_centroid(biggest)
    return out


def attach_centroid(prop: dict, centroid_by_gpin: dict) -> dict:
    """Set lat/lng (+ provenance) on a property from its parcel centroid, keyed by GPIN."""
    prop.setdefault("provenance", {})
    prop.setdefault("lat", None)
    prop.setdefault("lng", None)
    coord = centroid_by_gpin.get(prop.get("gpin"))
    if coord is None:
        return prop
    prop["lat"], prop["lng"] = coord
    prov = {"source": "parcel_area centroid (EPSG:4326)", "confidence": "real"}
    prop["provenance"]["lat"] = prov
    prop["provenance"]["lng"] = prov
    return prop


def fetch_parcel_centroids(gpins) -> dict:
    """Network: batch-fetch parcel polygons by GPIN and return {gpin(str): (lat, lng)}.
    GPINs are validated to ints (injection-safe) and chunked to respect URL limits."""
    safe = sorted({int(g) for g in gpins if str(g).strip().lstrip("-").isdigit()})
    out = {}
    for i in range(0, len(safe), 200):
        batch = safe[i:i + 200]
        params = {"where": "GPIN IN (%s)" % ",".join(str(g) for g in batch),
                  "returnGeometry": "true", "outSR": "4326", "outFields": "GPIN", "f": "json"}
        # POST so a large GPIN IN (...) can't overflow the URL length limit (404)
        body = urllib.parse.urlencode(params).encode("utf-8")
        req = urllib.request.Request(PARCEL_LAYER, data=body, headers={
            "User-Agent": "LOT-ingest/0.1", "Content-Type": "application/x-www-form-urlencoded"})
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        out.update(parse_parcel_features(data))
    return out
