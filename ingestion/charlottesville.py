#!/usr/bin/env python3
"""
Charlottesville county data ingestion — the "bypass the agents" SENSE layer.

Pulls raw parcel + assessment + sales data straight from the City of Charlottesville's
public ArcGIS REST open-data service. No MLS, no agent, no Zillow. This is the proof that
we can assemble our own property database from primary public records.

Verified live endpoints (City of Charlottesville OpenData_2 MapServer):
  - Layer 20: Real Estate (Base Data) — parcel identity + ZONE  (the by-room legality key)
  - Layer  1: Real Estate (Current Assessments) — assessed value
  - Layer  3: Real Estate (Sales) — transfer/sale history (tenure signal)

Real schema confirmed for Layer 20:
  RecordID_Int, Acreage, GPIN, IsActive, Legal, ParcelNumber, StreetNumber,
  StreetName, StateCode, TaxDist, TaxType, Unit, Zone

Usage:
  python charlottesville.py --limit 50 --out ../data/cville_sample.json
  python charlottesville.py --layer 20 --where "IsActive=1" --all
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request

# A parcel id is digits/letters with dots, underscores or hyphens — nothing that can
# alter an ArcGIS WHERE clause. Anything else (quotes, spaces, parens) is rejected.
_PARCEL_TOKEN = re.compile(r"^[0-9A-Za-z._-]+$")

BASE = "https://gisweb.charlottesville.org/arcgis/rest/services/OpenData_2/MapServer"

# Each layer must be ordered by a field it actually HAS, or ArcGIS returns
# "Invalid or missing input parameters" (0 features). Verified live: base/sales expose
# RecordID_Int; the Current Assessments layer does NOT — it must order by OBJECTID.
LAYERS = {
    "base":            {"id": 20, "order": "RecordID_Int"},  # parcel identity + Zone
    "assessments":     {"id": 1,  "order": "OBJECTID"},      # current assessed value
    "sales":           {"id": 3,  "order": "RecordID_Int"},  # sale/transfer history
    "residential":     {"id": 17, "order": "RecordID_Int"},  # beds/baths/sqft/year_built
    "all_assessments": {"id": 2,  "order": "RecordID_Int"},  # assessment history (land/impr/total/year)
}

PAGE_SIZE = 1000  # service maxRecordCount is 10000; 1000 keeps requests light


def layer_config(layer) -> dict:
    """Resolve a layer name ('base'/'assessments'/'sales') or numeric id to its config.

    Numeric ids pass through with a safe default order field (OBJECTID is present on
    every ArcGIS feature layer).
    """
    if layer in LAYERS:
        return LAYERS[layer]
    try:
        return {"id": int(layer), "order": "OBJECTID"}
    except (TypeError, ValueError):
        raise KeyError(f"Unknown layer '{layer}'. Use: {', '.join(LAYERS)} or a numeric id.")


def build_parcel_filters(parcels, chunk: int = 200) -> list[str]:
    """Build injection-safe `ParcelNumber IN (...)` WHERE clauses from external values.

    Parcel ids come from the county API (an untrusted boundary). Each value is validated
    against a strict token pattern; anything that could alter the clause (quotes, spaces,
    parens, SQL) is dropped. The list is chunked so a large pull can't blow the ArcGIS
    URL/clause length limit. Returns [] when no valid parcels remain.
    """
    safe = [p for p in parcels if isinstance(p, str) and _PARCEL_TOKEN.match(p)]
    clauses = []
    for i in range(0, len(safe), chunk):
        batch = safe[i:i + chunk]
        clauses.append("ParcelNumber IN (%s)" % ",".join("'%s'" % p for p in batch))
    return clauses


def build_query_params(layer, where: str = "1=1", offset: int = 0, count: int = PAGE_SIZE) -> dict:
    """Build the ArcGIS query params for a layer, ordering by that layer's real key."""
    cfg = layer_config(layer)
    return {
        "where": where,
        "outFields": "*",
        "returnGeometry": "false",
        "f": "json",
        "resultOffset": offset,
        "resultRecordCount": count,
        "orderByFields": cfg["order"],
    }


def _get(url: str, retries: int = 3, backoff: float = 2.0) -> dict:
    """GET a URL and parse JSON, with simple retry/backoff."""
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "LOT-ingest/0.1"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001 - want broad retry here
            last_err = e
            time.sleep(backoff * (attempt + 1))
    raise RuntimeError(f"Failed to GET {url}: {last_err}")


def query_layer(layer, where: str = "1=1", limit: int | None = None) -> list[dict]:
    """Page through an ArcGIS feature layer and return a list of attribute dicts.

    `layer` is a layer name ('base'/'assessments'/'sales') or a numeric id.
    """
    layer_id = layer_config(layer)["id"]
    rows: list[dict] = []
    offset = 0
    while True:
        page_count = PAGE_SIZE if limit is None else min(PAGE_SIZE, limit - len(rows))
        if page_count <= 0:
            break
        params = build_query_params(layer, where=where, offset=offset, count=page_count)
        url = f"{BASE}/{layer_id}/query?" + urllib.parse.urlencode(params)
        data = _get(url)
        feats = data.get("features", [])
        if not feats:
            break
        rows.extend(f.get("attributes", {}) for f in feats)
        if not data.get("exceededTransferLimit") and len(feats) < page_count:
            break
        offset += len(feats)
        if limit is not None and len(rows) >= limit:
            break
    return rows


def fetch_layer_meta(layer_id: int) -> dict:
    """Return the layer's field metadata (cheap; good for a connectivity check)."""
    return _get(f"{BASE}/{layer_id}?f=json")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Ingest Charlottesville county real estate data.")
    p.add_argument("--layer", default="base", help="base | assessments | sales | <id>")
    p.add_argument("--where", default="IsActive=1",
                   help="ArcGIS WHERE clause (TRUSTED operator input — never wire an "
                        "end-user filter here unsanitized; see build_parcel_filters)")
    p.add_argument("--limit", type=int, default=50, help="max rows (use --all for everything)")
    p.add_argument("--all", action="store_true", help="fetch all rows (ignores --limit)")
    p.add_argument("--out", default="-", help="output file path, or - for stdout")
    p.add_argument("--check", action="store_true", help="only print layer field metadata")
    args = p.parse_args(argv)

    try:
        layer_id = layer_config(args.layer)["id"]
    except KeyError as e:
        print(str(e), file=sys.stderr)
        return 2

    if args.check:
        meta = fetch_layer_meta(layer_id)
        fields = [f["name"] for f in meta.get("fields", [])]
        print(json.dumps({"layer": meta.get("name"), "fields": fields, "maxRecordCount": meta.get("maxRecordCount")}, indent=2))
        return 0

    limit = None if args.all else args.limit
    rows = query_layer(args.layer, where=args.where, limit=limit)
    payload = json.dumps(rows, indent=2)

    if args.out == "-":
        print(payload)
    else:
        import os
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(payload)
        print(f"Wrote {len(rows)} rows to {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
