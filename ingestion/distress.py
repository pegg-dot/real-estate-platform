"""Distress / neglect signals (spec 012 / Phase 4+) — FREE Charlottesville source.

MyCvilleRequests (OpenData_2 layer 30) carries geo-located citizen complaints. Two types are
classic VISIBLE-NEGLECT signals the lead-gen playbooks call motivated-seller tells: an overgrown
landscape and an abandoned vehicle on a property both signal a deferred-maintenance / checked-out
owner. We match those complaints to parcels (by canonical street key) and store them as
distress_signals that lift the motivation score. The table + the motivation wiring are
source-agnostic, so paid feeds (foreclosure/lis-pendens/probate) and scrapes drop in the same way.

Informational, not a determination — a complaint is a lead, not proof.
"""
from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request

from ingestion.owner import _street_key

REQUESTS_LAYER = "https://gisweb.charlottesville.org/arcgis/rest/services/OpenData_2/MapServer/30/query"

# request type -> (signal_type, severity). Keep to clear owner-neglect tells.
DISTRESS_TYPES = {
    "Overgrown Landscape": ("overgrown_landscape", "medium"),
    "Abandoned Vehicle": ("abandoned_vehicle", "low"),
}


def classify_request(request_type_name: str | None) -> tuple[str, str] | None:
    """Map a MyCvilleRequests type to (signal_type, severity), or None if not a distress tell."""
    return DISTRESS_TYPES.get((request_type_name or "").strip())


def addr_key(street_number, street_name) -> str:
    """Canonical street key (reuses the owner-absentee normalizer) so 'GROVE ST' == 'GROVE STREET'."""
    return _street_key(f"{street_number or ''} {street_name or ''}")


def _ms_to_iso(ms) -> str | None:
    if ms is None:
        return None
    try:
        import datetime
        d = datetime.datetime.utcfromtimestamp(ms / 1000).date()
        return None if d.year <= 1900 else d.isoformat()
    except Exception:
        return None


def parse_request(attrs: dict) -> dict | None:
    """A MyCvilleRequests record -> a distress signal dict, or None if not a distress type."""
    c = classify_request(attrs.get("RequestTypeName"))
    if not c:
        return None
    signal_type, severity = c
    return {
        "signal_type": signal_type, "severity": severity,
        "addr_key": addr_key(attrs.get("GeoLocationStreetNumber"), attrs.get("GeoLocationStreetName")),
        "observed_at": _ms_to_iso(attrs.get("DateCreated")),
        "lat": attrs.get("GeoLocationLatitude"), "lng": attrs.get("GeoLocationLongitude"),
        "request_id": attrs.get("RequestID"),
    }


def fetch_distress_requests(limit: int = 8000) -> list[dict]:
    """Network: pull the distress-type requests from MyCvilleRequests."""
    types = "','".join(DISTRESS_TYPES.keys())
    params = {
        "where": f"RequestTypeName IN ('{types}')",
        "outFields": "RequestTypeName,GeoLocationStreetNumber,GeoLocationStreetName,DateCreated,"
                     "GeoLocationLatitude,GeoLocationLongitude,RequestID",
        # this layer has no OID field, so pagination requires an explicit orderBy (same quirk as
        # the assessments layer) — without it ArcGIS 400s on resultRecordCount.
        "orderByFields": "RequestID",
        "returnGeometry": "false", "resultRecordCount": str(limit), "f": "json",
    }
    url = REQUESTS_LAYER + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "LOT-ingest/0.1"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    out = []
    for f in data.get("features", []):
        p = parse_request(f.get("attributes", {}))
        if p and p["addr_key"].strip():
            out.append(p)
    return out


def run(dsn: str | None = None, market: str = "Charlottesville") -> dict:
    """Fetch distress requests, match to parcels by street key, upsert distress_signal (idempotent)."""
    import psycopg
    from psycopg.types.json import Json
    dsn = dsn or os.environ["SUPABASE_DB_URL"]
    reqs = fetch_distress_requests()

    with psycopg.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute(
            "select p.id, p.address from property p join market m on m.id = p.market_id "
            "where m.name = %s and p.address is not null", (market,))
        by_addr: dict[str, str] = {}
        for pid, address in cur.fetchall():
            by_addr.setdefault(_street_key(address), pid)

        matched = 0
        for r in reqs:
            pid = by_addr.get(r["addr_key"])
            if not pid:
                continue
            cur.execute(
                "insert into distress_signal (property_id, signal_type, source, severity, detail, observed_at) "
                "values (%s, %s, 'mycville_requests', %s, %s, %s) "
                "on conflict (property_id, signal_type, source, observed_at) do nothing",
                (pid, r["signal_type"], r["severity"],
                 Json({"request_id": r["request_id"], "lat": r["lat"], "lng": r["lng"],
                       "provenance": {"source": "MyCvilleRequests", "confidence": "real"}}),
                 r["observed_at"]))
            matched += 1
        conn.commit()
    return {"requests": len(reqs), "matched": matched}


if __name__ == "__main__":
    print(run())
