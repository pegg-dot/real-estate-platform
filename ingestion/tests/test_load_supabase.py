"""Integration test for the env-gated Supabase loader (spec 002).

Proves the headline acceptance criterion at the loader level: re-running the ingest does
NOT duplicate rows (idempotent upsert). Skipped unless TEST_DATABASE_URL points at a
throwaway Postgres; the pure transform tests (test_normalize/test_assemble) run offline.
"""
import datetime
import json
import os
import pathlib

import pytest

from ingestion import load_supabase, normalize

DSN = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DSN, reason="set TEST_DATABASE_URL to run the loader integration test")

REPO = pathlib.Path(__file__).resolve().parents[2]
MIGRATION = REPO / "supabase" / "migrations" / "0001_core_schema.sql"
ZONING_CFG = REPO / "config" / "zoning" / "charlottesville.json"
FIX = pathlib.Path(__file__).parent / "fixtures"


def _load(name):
    return json.loads((FIX / name).read_text())


@pytest.fixture
def conn():
    import psycopg
    c = psycopg.connect(DSN, autocommit=True)
    c.execute("drop schema public cascade; create schema public;")
    c.execute(MIGRATION.read_text())
    c.autocommit = False
    yield c
    c.close()


def _counts(c):
    return {t: c.execute(f"select count(*) from {t}").fetchone()[0]
            for t in ("property", "assessment", "sale")}


def test_loader_is_idempotent(conn):
    market_id = load_supabase.upsert_market(conn, "Charlottesville", "VA")
    props = normalize.assemble_properties(
        _load("base_sample.json"), _load("assessments_sample.json"),
        _load("sales_sample.json"), market_id, as_of=datetime.date(2025, 1, 1))

    load_supabase.load_properties(conn, market_id, props)
    first = _counts(conn)

    load_supabase.load_properties(conn, market_id, props)   # re-run, same data
    second = _counts(conn)

    assert first == second, f"re-run changed row counts: {first} -> {second}"
    assert first["property"] == len(props)
    assert first["sale"] > 0 and first["assessment"] > 0


def test_loader_updates_changed_value_without_inserting(conn):
    market_id = load_supabase.upsert_market(conn, "Charlottesville", "VA")
    props = normalize.assemble_properties(
        _load("base_sample.json"), _load("assessments_sample.json"),
        _load("sales_sample.json"), market_id, as_of=datetime.date(2025, 1, 1))
    load_supabase.load_properties(conn, market_id, props)
    before = _counts(conn)

    # mutate one property's assessed value; re-load should UPDATE, not duplicate
    props[0]["assessment"]["assessed_total"] = 999999
    props[0]["est_market_value"] = 999999
    load_supabase.load_properties(conn, market_id, props)

    assert _counts(conn) == before
    apn = props[0]["apn"]
    val = conn.execute(
        "select assessed_total from assessment a join property p on p.id=a.property_id "
        "where p.apn=%s", (apn,)).fetchone()[0]
    assert val == 999999


def test_loader_persists_real_beds(conn):
    market_id = load_supabase.upsert_market(conn, "Charlottesville", "VA")
    props = normalize.assemble_properties(
        _load("base_sample.json"), _load("assessments_sample.json"),
        _load("sales_sample.json"), market_id, as_of=datetime.date(2025, 1, 1),
        residential_rows=_load("residential_sample.json"))
    load_supabase.load_properties(conn, market_id, props)
    beds = conn.execute("select beds from property where apn=%s", ("010006000",)).fetchone()[0]
    assert beds == 6


def test_loaded_property_surfaces_by_room_legality_with_caveat(conn):
    # The headline first-class field must survive a load on the PARCEL itself, not just
    # the rule table — and carry its litigation caveat (golden rules #3, #4).
    import json

    from ingestion import zoning
    market_id = load_supabase.upsert_market(conn, "Charlottesville", "VA")
    rules = json.loads(ZONING_CFG.read_text())
    load_supabase.upsert_zoning_rules(conn, market_id, rules)
    props = normalize.assemble_properties(
        _load("base_sample.json"), _load("assessments_sample.json"),
        _load("sales_sample.json"), market_id, as_of=datetime.date(2025, 1, 1))
    for p in props:
        zoning.attach_zoning(p, rules)
    load_supabase.load_properties(conn, market_id, props)

    row = conn.execute(
        "select by_room_legal, zoning->>'stability_flag' from property limit 1").fetchone()
    assert row[0] is True
    assert "White v. City of Charlottesville" in row[1]


def test_zoning_rules_seeded_idempotently(conn):
    import json
    market_id = load_supabase.upsert_market(conn, "Charlottesville", "VA")
    rules = json.loads(ZONING_CFG.read_text())

    load_supabase.upsert_zoning_rules(conn, market_id, rules)
    n1 = conn.execute("select count(*) from zoning_rule").fetchone()[0]
    load_supabase.upsert_zoning_rules(conn, market_id, rules)   # re-run
    n2 = conn.execute("select count(*) from zoning_rule").fetchone()[0]

    assert n1 == n2 and n1 >= 1
    # the citywide default is stored as the '*' zone and is by-room legal, with a caveat
    row = conn.execute(
        "select by_room_legal, stability_flag from zoning_rule "
        "where market_id=%s and zone_code='*'", (market_id,)).fetchone()
    assert row[0] is True
    assert "White v. City of Charlottesville" in row[1]
