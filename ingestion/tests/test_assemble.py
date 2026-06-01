"""TDD for the join/assemble step (spec 002): base + assessments + sales -> one
property record per parcel with attached assessment, sales, last sale, and the derived
owner-tenure signal. Pure function over fixtures; `as_of` is injected for determinism.
"""
import datetime
import json
import os

from ingestion import normalize

FIX = os.path.join(os.path.dirname(__file__), "fixtures")


def load(name):
    with open(os.path.join(FIX, name)) as fh:
        return json.load(fh)


BASE = load("base_sample.json")
ASSESS = load("assessments_sample.json")
SALES = load("sales_sample.json")
RESIDENTIAL = load("residential_sample.json")
MARKET_ID = "11111111-1111-1111-1111-111111111111"
AS_OF = datetime.date(2025, 1, 1)


def assemble(residential=None):
    return {p["apn"]: p for p in
            normalize.assemble_properties(BASE, ASSESS, SALES, MARKET_ID, as_of=AS_OF,
                                          residential_rows=residential)}


def test_assemble_returns_one_record_per_base_parcel():
    props = normalize.assemble_properties(BASE, ASSESS, SALES, MARKET_ID, as_of=AS_OF)
    assert len(props) == len(BASE)


def test_assemble_attaches_assessment_and_last_sale_where_available():
    p = assemble()["010004300"]
    assert p["assessment"] is not None
    assert p["assessment"]["assessed_total"] is not None
    assert p["last_sale"] is not None
    # est_market_value baseline comes from the assessment, flagged non-real
    assert p["est_market_value"] == p["assessment"]["assessed_total"]
    assert p["provenance"]["est_market_value"]["confidence"] != "real"


def test_tenure_is_years_since_last_ARMS_LENGTH_sale_not_last_transfer():
    # 010001100's most-recent transfer is a $0 (non-arm's-length) 2022 deed, but the
    # owner's real acquisition is the 2008-09-23 arm's-length sale. Tenure must use the
    # latter (this is exactly what the financing engine keys sub2/seller-finance on).
    p = assemble()["010001100"]
    assert p["last_sale"]["sale_date"] == "2022-12-01"
    assert p["last_sale"]["is_arms_length"] is False
    assert p["tenure_years"] == 16.27


def test_tenure_simple_case():
    p = assemble()["010004300"]   # last arm's-length 2001-04-19
    assert p["tenure_years"] == 23.7


def test_parcel_without_sales_has_null_last_sale_and_tenure():
    p = assemble()["010004500"]   # in base, no sales
    assert p["last_sale"] is None
    assert p["tenure_years"] is None
    assert p["sales"] == []


def test_sales_are_sorted_oldest_to_newest():
    p = assemble()["010001100"]
    dates = [s["sale_date"] for s in p["sales"]]
    assert dates == sorted(dates)


def test_assemble_attaches_real_beds_from_residential_details():
    # 010006000 is a Single Family with real beds in layer 17 — replaces MODELED beds
    p = assemble(residential=RESIDENTIAL)["010006000"]
    assert p["beds"] == 6
    assert p["baths"] == 4.5
    assert p["year_built"] == 1940
    assert p["provenance"]["beds"]["confidence"] == "real"


def test_assemble_without_residential_leaves_beds_null():
    p = assemble()["010006000"]
    assert p.get("beds") is None

