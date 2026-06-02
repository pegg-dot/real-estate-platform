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


def upsert_market(conn, name: str, state: str, data_source_config: dict | None = None) -> str:
    """Upsert a market by (name, state) and return its id. Persists the ArcGIS endpoint
    config on the market row so the data source is recorded in the DB, not just in code."""
    from psycopg.types.json import Json

    cfg = Json(data_source_config) if data_source_config is not None else Json({})
    row = conn.execute(
        "insert into market (name, state, data_source_config) values (%s, %s, %s) "
        "on conflict (name, state) do update set "
        "  data_source_config = excluded.data_source_config, updated_at = now() "
        "returning id",
        (name, state, cfg),
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
            "   rooming_house_allowed, str_allowed, source_url, as_of_date, stability_flag) "
            "values (%s,%s,%s,%s,%s,%s,%s,%s,%s) "
            "on conflict (market_id, zone_code) do update set "
            "  max_unrelated_occupants = excluded.max_unrelated_occupants, "
            "  by_room_legal = excluded.by_room_legal, "
            "  rooming_house_allowed = excluded.rooming_house_allowed, "
            "  str_allowed = excluded.str_allowed, "
            "  source_url = excluded.source_url, as_of_date = excluded.as_of_date, "
            "  stability_flag = excluded.stability_flag",
            (market_id, zone_code, rule.get("max_unrelated_occupants"),
             rule.get("by_room_legal"), rule.get("rooming_house_allowed"),
             rule.get("str_allowed"),
             rules.get("source_url"), rules.get("as_of_date"), rules.get("stability_flag")),
        )
    conn.commit()
    return len(rows)


def upsert_risk_profile(conn, property_id: str, flood: dict) -> None:
    """Idempotently upsert a property's risk profile (currently FEMA flood zone)."""
    from psycopg.types.json import Json

    conn.execute(
        "insert into risk_profile (property_id, flood_zone, provenance) "
        "values (%s, %s, %s) "
        "on conflict (property_id) do update set "
        "  flood_zone = excluded.flood_zone, provenance = excluded.provenance",
        (property_id, flood.get("flood_zone"),
         Json({"flood_zone": flood.get("provenance"), "subtype": flood.get("subtype")})),
    )


def upsert_owner(conn, market_id: str, o: dict) -> str:
    """Upsert an owner (dedupe on market+name+mailing) and return its id."""
    row = conn.execute(
        "insert into owner (market_id, name, mailing_address, is_absentee, entity_type) "
        "values (%s,%s,%s,%s,%s) "
        "on conflict (market_id, name, mailing_address) do update set "
        "  is_absentee = excluded.is_absentee, entity_type = excluded.entity_type "
        "returning id",
        (market_id, o["name"], o["mailing_address"], o["is_absentee"], o["entity_type"]),
    ).fetchone()
    return row[0]


def load_properties(conn, market_id: str, properties: list[dict]) -> dict:
    """Idempotently upsert assembled property records + their assessment and sales.

    Upsert targets mirror supabase/migrations/0001_core_schema.sql:
      property   -> (market_id, apn)   [apn = ParcelNumber; condo units share GPIN]
      assessment -> (property_id, year)  [NULLS NOT DISTINCT]
      sale       -> (source_record_id)
    """
    from psycopg.types.json import Json   # local import: keeps the module importable
                                          # for offline test collection without psycopg

    counts = {"property": 0, "assessment": 0, "sale": 0, "owner": 0}
    # accumulate child rows and batch-insert them after the loop (one pipelined executemany
    # each) instead of a network round-trip per row — critical at city scale (~30 assessment
    # years per parcel would otherwise be tens of thousands of round trips over the pooler).
    assess_params: list = []
    sale_params: list = []
    # collect the RETURNING ids from an executemany (one per input tuple, in order)
    def _returned_ids(cur):
        out = []
        while True:
            row = cur.fetchone()
            out.append(row[0] if row else None)
            if not cur.nextset():
                break
        return out

    # 1. batch-upsert DISTINCT owners -> (name, mailing) -> owner_id
    owner_by_key: dict = {}
    for p in properties:
        o = p.get("owner")
        if o:
            owner_by_key[(o["name"], o["mailing_address"])] = o
    owner_id_by_key: dict = {}
    owners = list(owner_by_key.values())
    if owners:
        with conn.cursor() as cur:
            cur.executemany(
                "insert into owner (market_id, name, mailing_address, is_absentee, entity_type) "
                "values (%s,%s,%s,%s,%s) "
                "on conflict (market_id, name, mailing_address) do update set "
                "  is_absentee = excluded.is_absentee, entity_type = excluded.entity_type "
                "returning id",
                [(market_id, o["name"], o["mailing_address"], o["is_absentee"], o["entity_type"])
                 for o in owners], returning=True)
            for o, oid in zip(owners, _returned_ids(cur)):
                owner_id_by_key[(o["name"], o["mailing_address"])] = oid
        counts["owner"] = len(owners)

    # 2. batch-upsert properties -> apn -> pid (executemany RETURNING preserves order)
    prop_params = []
    for p in properties:
        o = p.get("owner")
        owner_id = owner_id_by_key.get((o["name"], o["mailing_address"])) if o else None
        prop_params.append(
            (market_id, p["apn"], p["gpin"], p["address"], p.get("lat"), p.get("lng"),
             p["acreage"], p["zone_code"], p["legal_desc"], p["tax_district"], p["is_active"],
             p.get("beds"), p.get("baths"), p.get("sqft"), p.get("year_built"),
             p.get("by_room_legal"), p.get("max_unrelated_occupants"),
             Json(p["zoning"]) if p.get("zoning") is not None else None, owner_id,
             p["est_market_value"], Json(p["provenance"])))
    with conn.cursor() as cur:
        cur.executemany(
            "insert into property "
            "  (market_id, apn, gpin, address, lat, lng, acreage, zone_code, legal_desc, "
            "   tax_district, is_active, beds, baths, sqft, year_built, "
            "   by_room_legal, max_unrelated_occupants, zoning, owner_id, "
            "   est_market_value, provenance, last_seen_at) "
            "values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now()) "
            "on conflict (market_id, apn) do update set "
            "  gpin = excluded.gpin, address = excluded.address, "
            "  lat = coalesce(excluded.lat, property.lat), "
            "  lng = coalesce(excluded.lng, property.lng), "
            "  acreage = excluded.acreage, zone_code = excluded.zone_code, "
            "  legal_desc = excluded.legal_desc, tax_district = excluded.tax_district, "
            "  is_active = excluded.is_active, beds = excluded.beds, baths = excluded.baths, "
            "  sqft = excluded.sqft, year_built = excluded.year_built, "
            "  by_room_legal = excluded.by_room_legal, "
            "  max_unrelated_occupants = excluded.max_unrelated_occupants, zoning = excluded.zoning, "
            "  owner_id = coalesce(excluded.owner_id, property.owner_id), "
            "  est_market_value = excluded.est_market_value, provenance = excluded.provenance, "
            "  last_seen_at = now() "
            "returning id",
            prop_params, returning=True)
        pids = _returned_ids(cur)
    apn_to_pid = {p["apn"]: pid for p, pid in zip(properties, pids)}
    counts["property"] = len(properties)

    # 3. risk_profile (only present with --flood) + collect child rows keyed by pid
    for p in properties:
        pid = apn_to_pid[p["apn"]]
        if p.get("flood"):
            upsert_risk_profile(conn, pid, p["flood"])
        assessments = p.get("assessments") or ([p["assessment"]] if p.get("assessment") else [])
        for a in assessments:
            assess_params.append(
                (pid, a["year"], a["assessed_land"], a["assessed_improvement"],
                 a["assessed_total"], a["source"], a["source_object_id"]))
        for s in p.get("sales", []):
            if s["source_record_id"] is None:
                continue  # cannot dedupe a sale with no stable source id
            sale_params.append(
                (pid, s["source_record_id"], s["sale_date"], s["sale_price"], s["grantor"],
                 s["grantee"], s["deed_ref"], s["is_arms_length"], s["source"]))

    # batch-insert the children (pipelined; ON CONFLICT keeps it idempotent)
    if assess_params:
        with conn.cursor() as cur:
            cur.executemany(
                "insert into assessment "
                "  (property_id, year, assessed_land, assessed_improvement, assessed_total, "
                "   source, source_object_id) "
                "values (%s,%s,%s,%s,%s,%s,%s) "
                "on conflict (property_id, year) do update set "
                "  assessed_land = excluded.assessed_land, "
                "  assessed_improvement = excluded.assessed_improvement, "
                "  assessed_total = excluded.assessed_total, "
                "  source = excluded.source, source_object_id = excluded.source_object_id",
                assess_params)
        counts["assessment"] = len(assess_params)
    if sale_params:
        with conn.cursor() as cur:
            cur.executemany(
                "insert into sale "
                "  (property_id, source_record_id, sale_date, sale_price, grantor, grantee, "
                "   deed_ref, is_arms_length, source) "
                "values (%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                "on conflict (source_record_id) do update set "
                "  property_id = excluded.property_id, sale_date = excluded.sale_date, "
                "  sale_price = excluded.sale_price, deed_ref = excluded.deed_ref, "
                "  is_arms_length = excluded.is_arms_length",
                sale_params)
        counts["sale"] = len(sale_params)

    conn.commit()
    return counts


def run(dsn: str | None = None, where: str = "IsActive=1", limit: int | None = None,
        geocode: bool = False, flood: bool = False, history: bool = True) -> dict:
    """Full live pipeline: pull -> assemble -> upsert. Reads SUPABASE_DB_URL if dsn unset.
    When geocode=True, also resolve real lat/lng per address via the city locator (opt-in;
    one network call per property)."""
    import psycopg

    dsn = dsn or os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        raise SystemExit("SUPABASE_DB_URL not set — refusing to run the live load.")

    import pathlib

    from ingestion import geocode as geo
    from ingestion import geometry
    from ingestion import owner as owner_mod
    from ingestion import zoning

    base = cv.query_layer("base", where=where, limit=limit)
    parcels = [r["ParcelNumber"] for r in base if r.get("ParcelNumber")]
    # injection-safe, chunked filters (parcel ids are external county-API input).
    # history=True pulls 30 yrs of assessments (layer 2); history=False pulls only the
    # current value (layer 1) — ~30x fewer rows, the fast path for bulk city loads since
    # scoring only needs the latest value.
    sales, residential, assess_hist, assess_current = [], [], [], []
    for clause in cv.build_parcel_filters(parcels):
        sales.extend(cv.query_layer("sales", where=clause))
        residential.extend(cv.query_layer("residential", where=clause))
        if history:
            assess_hist.extend(cv.query_layer("all_assessments", where=clause))
        else:
            assess_current.extend(cv.query_layer("assessments", where=clause))

    owners = owner_mod.fetch_owners(parcels)   # owner name/mailing -> is_absentee + entity_type

    # parcel centroids (the always-on base coordinate for every parcel)
    centroids = geometry.fetch_parcel_centroids(r.get("GPIN") for r in base if r.get("GPIN") is not None)

    zoning_cfg = pathlib.Path(__file__).resolve().parents[1] / "config" / "zoning" / "charlottesville.json"
    rules = zoning.load_zoning_rules(zoning_cfg)

    data_source_config = {
        "arcgis_base": cv.BASE,
        "layers": cv.LAYERS,
        "owner_table": "NDS_parcel_relate/MapServer/1",
        "parcel_geometry": "NDS_parcel_relate/MapServer/0",
        "geocoder": "composite_locator_WGS/GeocodeServer",
    }
    with psycopg.connect(dsn) as conn:
        market_id = upsert_market(conn, "Charlottesville", "VA", data_source_config)
        upsert_zoning_rules(conn, market_id, rules)
        # assess_rows=[] is deliberate: layer 2 (All Assessments history) supersedes the
        # layer-1 current-only snapshot, so we use `all_assessment_rows` as the source.
        props = normalize.assemble_properties(base, assess_current, sales, market_id,
                                              as_of=datetime.date.today(),
                                              residential_rows=residential,
                                              all_assessment_rows=(assess_hist or None),
                                              owner_rows=owners)
        for p in props:
            zoning.attach_zoning(p, rules)            # surface by-room legality on each record
            geometry.attach_centroid(p, centroids)    # base lat/lng for every parcel
            if geocode:                               # precise override only at score >= 99
                geo.attach_geocode(p, geocoder=lambda a: geo.geocode_address(a, min_score=99))
            if flood and p.get("lat") is not None and p.get("lng") is not None:
                from ingestion import flood as flood_mod
                p["flood"] = flood_mod.fetch_flood_zone(p["lat"], p["lng"])
        counts = load_properties(conn, market_id, props)
    return counts


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Load Charlottesville data into Supabase/Postgres.")
    p.add_argument("--where", default="IsActive=1")
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--geocode", action="store_true",
                   help="resolve real lat/lng per address via the city locator (one call each)")
    p.add_argument("--flood", action="store_true",
                   help="enrich risk_profile with the FEMA flood zone per parcel (one call each)")
    p.add_argument("--no-history", action="store_true",
                   help="pull only the current assessed value (fast path for bulk city loads)")
    args = p.parse_args(argv)
    counts = run(where=args.where, limit=args.limit, geocode=args.geocode, flood=args.flood,
                 history=not args.no_history)
    print(f"Loaded: {counts}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
