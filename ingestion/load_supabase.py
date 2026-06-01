"""Env-gated Supabase/Postgres loader for the Charlottesville ingest (spec 002).

Separated from the pure transform layer (normalize.py) per ADR 0001 #3: all the
judgment-free math/joins are unit-tested offline; this module only persists, behind
ON CONFLICT upserts that mirror the migration's natural keys so re-runs never duplicate
rows. The live connection is read from SUPABASE_DB_URL — never hardcode credentials.

Usage (full pipeline, live):
    SUPABASE_DB_URL=postgres://... python -m ingestion.load_supabase --where "IsActive=1" --limit 500
"""
from __future__ import annotations

import argparse
import datetime
import os
import sys

from ingestion import charlottesville as cv
from ingestion import normalize


def upsert_market(conn, name: str, state: str) -> str:
    """Upsert a market by (name, state) and return its id."""
    row = conn.execute(
        "insert into market (name, state) values (%s, %s) "
        "on conflict (name, state) do update set updated_at = now() "
        "returning id",
        (name, state),
    ).fetchone()
    conn.commit()
    return row[0]


def upsert_zoning_rules(conn, market_id: str, rules: dict) -> int:
    """Seed the zoning_rule table from a market's curated config (config/zoning/<market>.json).

    The citywide default is stored as the sentinel zone_code '*'; explicit per-zone
    overrides are stored under their zone_code. Idempotent on (market_id, zone_code).
    """
    rows = []
    if rules.get("default"):
        rows.append(("*", rules["default"]))
    for zone_code, rule in (rules.get("zones") or {}).items():
        if zone_code.startswith("$"):   # skip $comment keys
            continue
        rows.append((zone_code, rule))

    for zone_code, rule in rows:
        conn.execute(
            "insert into zoning_rule "
            "  (market_id, zone_code, max_unrelated_occupants, by_room_legal, "
            "   rooming_house_allowed, source_url, as_of_date, stability_flag) "
            "values (%s,%s,%s,%s,%s,%s,%s,%s) "
            "on conflict (market_id, zone_code) do update set "
            "  max_unrelated_occupants = excluded.max_unrelated_occupants, "
            "  by_room_legal = excluded.by_room_legal, "
            "  rooming_house_allowed = excluded.rooming_house_allowed, "
            "  source_url = excluded.source_url, as_of_date = excluded.as_of_date, "
            "  stability_flag = excluded.stability_flag",
            (market_id, zone_code, rule.get("max_unrelated_occupants"),
             rule.get("by_room_legal"), rule.get("rooming_house_allowed"),
             rules.get("source_url"), rules.get("as_of_date"), rules.get("stability_flag")),
        )
    conn.commit()
    return len(rows)


def load_properties(conn, market_id: str, properties: list[dict]) -> dict:
    """Idempotently upsert assembled property records + their assessment and sales.

    Upsert targets mirror supabase/migrations/0001_core_schema.sql:
      property   -> (market_id, apn)   [apn = ParcelNumber; condo units share GPIN]
      assessment -> (property_id, year)  [NULLS NOT DISTINCT]
      sale       -> (source_record_id)
    """
    from psycopg.types.json import Json   # local import: keeps the module importable
                                          # for offline test collection without psycopg

    counts = {"property": 0, "assessment": 0, "sale": 0}
    for p in properties:
        pid = conn.execute(
            "insert into property "
            "  (market_id, apn, gpin, address, acreage, zone_code, legal_desc, "
            "   tax_district, is_active, beds, baths, sqft, year_built, "
            "   by_room_legal, max_unrelated_occupants, zoning, "
            "   est_market_value, provenance, last_seen_at) "
            "values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now()) "
            "on conflict (market_id, apn) do update set "
            "  gpin = excluded.gpin, address = excluded.address, acreage = excluded.acreage, "
            "  zone_code = excluded.zone_code, legal_desc = excluded.legal_desc, "
            "  tax_district = excluded.tax_district, is_active = excluded.is_active, "
            "  beds = excluded.beds, baths = excluded.baths, sqft = excluded.sqft, "
            "  year_built = excluded.year_built, by_room_legal = excluded.by_room_legal, "
            "  max_unrelated_occupants = excluded.max_unrelated_occupants, zoning = excluded.zoning, "
            "  est_market_value = excluded.est_market_value, provenance = excluded.provenance, "
            "  last_seen_at = now() "
            "returning id",
            (market_id, p["apn"], p["gpin"], p["address"], p["acreage"], p["zone_code"],
             p["legal_desc"], p["tax_district"], p["is_active"],
             p.get("beds"), p.get("baths"), p.get("sqft"), p.get("year_built"),
             p.get("by_room_legal"), p.get("max_unrelated_occupants"),
             Json(p["zoning"]) if p.get("zoning") is not None else None,
             p["est_market_value"], Json(p["provenance"])),
        ).fetchone()[0]
        counts["property"] += 1

        a = p.get("assessment")
        if a:
            conn.execute(
                "insert into assessment "
                "  (property_id, year, assessed_land, assessed_improvement, assessed_total, "
                "   source, source_object_id) "
                "values (%s,%s,%s,%s,%s,%s,%s) "
                "on conflict (property_id, year) do update set "
                "  assessed_total = excluded.assessed_total, "
                "  source_object_id = excluded.source_object_id",
                (pid, a["year"], a["assessed_land"], a["assessed_improvement"],
                 a["assessed_total"], a["source"], a["source_object_id"]),
            )
            counts["assessment"] += 1

        for s in p.get("sales", []):
            if s["source_record_id"] is None:
                continue  # cannot dedupe a sale with no stable source id
            conn.execute(
                "insert into sale "
                "  (property_id, source_record_id, sale_date, sale_price, grantor, grantee, "
                "   deed_ref, is_arms_length, source) "
                "values (%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                "on conflict (source_record_id) do update set "
                "  property_id = excluded.property_id, sale_date = excluded.sale_date, "
                "  sale_price = excluded.sale_price, deed_ref = excluded.deed_ref, "
                "  is_arms_length = excluded.is_arms_length",
                (pid, s["source_record_id"], s["sale_date"], s["sale_price"], s["grantor"],
                 s["grantee"], s["deed_ref"], s["is_arms_length"], s["source"]),
            )
            counts["sale"] += 1

    conn.commit()
    return counts


def run(dsn: str | None = None, where: str = "IsActive=1", limit: int | None = None) -> dict:
    """Full live pipeline: pull -> assemble -> upsert. Reads SUPABASE_DB_URL if dsn unset."""
    import psycopg

    dsn = dsn or os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        raise SystemExit("SUPABASE_DB_URL not set — refusing to run the live load.")

    import json
    import pathlib

    from ingestion import zoning

    base = cv.query_layer("base", where=where, limit=limit)
    parcels = [r["ParcelNumber"] for r in base if r.get("ParcelNumber")]
    # injection-safe, chunked filters (parcel ids are external county-API input)
    assess, sales, residential = [], [], []
    for clause in cv.build_parcel_filters(parcels):
        assess.extend(cv.query_layer("assessments", where=clause))
        sales.extend(cv.query_layer("sales", where=clause))
        residential.extend(cv.query_layer("residential", where=clause))

    zoning_cfg = pathlib.Path(__file__).resolve().parents[1] / "config" / "zoning" / "charlottesville.json"
    rules = zoning.load_zoning_rules(zoning_cfg)

    with psycopg.connect(dsn) as conn:
        market_id = upsert_market(conn, "Charlottesville", "VA")
        upsert_zoning_rules(conn, market_id, rules)
        props = normalize.assemble_properties(base, assess, sales, market_id,
                                              as_of=datetime.date.today(),
                                              residential_rows=residential)
        for p in props:
            zoning.attach_zoning(p, rules)   # surface by-room legality on each record
        counts = load_properties(conn, market_id, props)
    return counts


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Load Charlottesville data into Supabase/Postgres.")
    p.add_argument("--where", default="IsActive=1")
    p.add_argument("--limit", type=int, default=None)
    args = p.parse_args(argv)
    counts = run(where=args.where, limit=args.limit)
    print(f"Loaded: {counts}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
