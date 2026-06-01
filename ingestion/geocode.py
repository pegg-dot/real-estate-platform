"""Geocoding for Charlottesville (real lat/lng for map pins).

The OpenData parcel layers are non-spatial (no geometry), so coordinates come from the
City's own ArcGIS locator (composite_locator_WGS, WGS84). The response parser is pure and
unit-tested; `geocode_address` is a thin network wrapper; `attach_geocode` decorates a
property record and takes an injected geocoder so the pipeline stays testable offline.

Geocoding is OPT-IN in the loader (one network call per address) — the core ingest never
depends on it.
"""
from __future__ import annotations

import urllib.parse
import urllib.request

LOCATOR = ("https://gisweb.charlottesville.org/arcgis/rest/services/"
           "composite_locator_WGS/GeocodeServer/findAddressCandidates")


def parse_candidates(response: dict, min_score: float = 90) -> dict | None:
    """Pick the best candidate from a findAddressCandidates response. Returns
    {lat, lng, score, matched} or None if there's no candidate at/above min_score."""
    candidates = response.get("candidates") or []
    if not candidates:
        return None
    best = max(candidates, key=lambda c: c.get("score", 0))
    score = best.get("score", 0)
    if score < min_score:
        return None
    loc = best.get("location") or {}
    if loc.get("x") is None or loc.get("y") is None:
        return None
    return {"lat": loc["y"], "lng": loc["x"], "score": score, "matched": best.get("address")}


def geocode_address(address: str, min_score: float = 90) -> dict | None:
    """Network: geocode a single-line address via the city locator (WGS84)."""
    params = {"SingleLine": address, "outFields": "*", "maxLocations": "1",
              "outSR": "4326", "f": "json"}
    url = LOCATOR + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "LOT-ingest/0.1"})
    import json
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return parse_candidates(data, min_score=min_score)


def attach_geocode(prop: dict, geocoder=geocode_address) -> dict:
    """Set lat/lng (+ provenance) on a property from its address. No-op without an address
    or a match. Score >= 99 -> confidence 'real' (exact); otherwise 'estimated'."""
    prop.setdefault("provenance", {})
    prop.setdefault("lat", None)
    prop.setdefault("lng", None)
    address = prop.get("address")
    if not address:
        return prop
    g = geocoder(address)
    if not g:
        return prop
    prop["lat"] = g["lat"]
    prop["lng"] = g["lng"]
    prop["provenance"]["lat"] = {
        "source": "composite_locator_WGS",
        "confidence": "real" if g["score"] >= 99 else "estimated",
        "score": g["score"],
    }
    prop["provenance"]["lng"] = prop["provenance"]["lat"]
    return prop
