"""FEMA flood-zone enrichment (free, public — no account) for risk_profile.

The scoring engine penalizes flood risk (spec 003) and it's a deal-killer for Miami, but
risk_profile was empty so the risk component was dead. This wires the FEMA National Flood
Hazard Layer (queried by the property's lat/lng) into risk_profile. Opt-in (--flood): one
network call per parcel, like --geocode.
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request

# FEMA NFHL — flood hazard zones (layer 28), WGS84 point query.
NFHL = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query"

# Special Flood Hazard Areas (high risk) start with A or V; X = minimal.
def is_high_risk(zone: str | None) -> bool:
    return bool(zone) and zone[0] in ("A", "V")


def parse_flood_response(data: dict) -> dict:
    """Parse an NFHL point query into a flood record. No intersecting polygon => the point
    is outside any mapped SFHA => treat as zone X (minimal hazard)."""
    feats = data.get("features", [])
    if not feats:
        return {"flood_zone": "X", "subtype": "unmapped / minimal flood hazard",
                "high_risk": False, "provenance": {"source": "FEMA NFHL", "confidence": "real"}}
    a = feats[0].get("attributes", {})
    zone = a.get("FLD_ZONE")
    return {"flood_zone": zone, "subtype": a.get("ZONE_SUBTY"),
            "high_risk": is_high_risk(zone),
            "provenance": {"source": "FEMA NFHL", "confidence": "real"}}


def fetch_flood_zone(lat: float, lng: float) -> dict:
    """Network: look up the FEMA flood zone at a point (lat/lng in WGS84)."""
    geom = {"x": lng, "y": lat, "spatialReference": {"wkid": 4326}}
    params = {"geometry": json.dumps(geom), "geometryType": "esriGeometryPoint", "inSR": "4326",
              "spatialRel": "esriSpatialRelIntersects", "outFields": "FLD_ZONE,ZONE_SUBTY",
              "returnGeometry": "false", "f": "json"}
    url = NFHL + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "LOT-ingest/0.1"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return parse_flood_response(json.loads(resp.read().decode("utf-8")))
