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
import sys
import time
import urllib.parse
import urllib.request

BASE = "https://gisweb.charlottesville.org/arcgis/rest/services/OpenData_2/MapServer"

LAYERS = {
    "base": 20,          # parcel identity + Zone
    "assessments": 1,    # current assessed value
    "sales": 3,          # sale/transfer history
}

PAGE_SIZE = 1000  # service maxRecordCount is 10000; 1000 keeps requests light


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


def query_layer(layer_id: int, where: str = "1=1", limit: int | None = None) -> list[dict]:
    """Page through an ArcGIS feature layer and return a list of attribute dicts."""
    rows: list[dict] = []
    offset = 0
    while True:
        page_count = PAGE_SIZE if limit is None else min(PAGE_SIZE, limit - len(rows))
        if page_count <= 0:
            break
        params = {
            "where": where,
            "outFields": "*",
            "returnGeometry": "false",
            "f": "json",
            "resultOffset": offset,
            "resultRecordCount": page_count,
            "orderByFields": "RecordID_Int",
        }
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
    p.add_argument("--where", default="IsActive=1", help="ArcGIS WHERE clause")
    p.add_argument("--limit", type=int, default=50, help="max rows (use --all for everything)")
    p.add_argument("--all", action="store_true", help="fetch all rows (ignores --limit)")
    p.add_argument("--out", default="-", help="output file path, or - for stdout")
    p.add_argument("--check", action="store_true", help="only print layer field metadata")
    args = p.parse_args(argv)

    layer_id = LAYERS.get(args.layer, None)
    if layer_id is None:
        try:
            layer_id = int(args.layer)
        except ValueError:
            print(f"Unknown layer '{args.layer}'. Use: {', '.join(LAYERS)} or a numeric id.", file=sys.stderr)
            return 2

    if args.check:
        meta = fetch_layer_meta(layer_id)
        fields = [f["name"] for f in meta.get("fields", [])]
        print(json.dumps({"layer": meta.get("name"), "fields": fields, "maxRecordCount": meta.get("maxRecordCount")}, indent=2))
        return 0

    limit = None if args.all else args.limit
    rows = query_layer(layer_id, where=args.where, limit=limit)
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
