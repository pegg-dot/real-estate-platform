"""TDD for the pure normalization layer (spec 002).

Transforms raw Charlottesville ArcGIS attribute dicts into records shaped for the
unified schema (supabase/migrations/0001_core_schema.sql), with real-vs-modeled
provenance (ADR 0001 #5). No network, no DB — pure functions over fixtures.
"""
import json
import os

from ingestion import normalize

FIX = os.path.join(os.path.dirname(__file__), "fixtures")


def load(name):
    with open(os.path.join(FIX, name)) as fh:
        return json.load(fh)


BASE = load("base_sample.json")
MARKET_ID = "11111111-1111-1111-1111-111111111111"


# --- normalize_property -----------------------------------------------------

def test_every_base_row_normalizes_to_nonnull_gpin_and_zone():
    # Spec 002 acceptance: a pull parses into valid property rows with non-null
    # gpin and zone_code.
    for raw in BASE:
        prop = normalize.normalize_property(raw, MARKET_ID)
        assert prop["gpin"], f"null gpin for {raw.get('ParcelNumber')}"
        assert prop["zone_code"], f"null zone_code for {raw.get('ParcelNumber')}"


def test_normalize_property_core_fields():
    raw = BASE[0]  # 1117 EMMET ST N, GPIN 1326, Zone NX-10, 39.77 ac, IsActive 1
    prop = normalize.normalize_property(raw, MARKET_ID)
    assert prop["market_id"] == MARKET_ID
    assert prop["apn"] == "010001000"
    assert prop["gpin"] == "1326"           # int in source -> stringified (schema: text)
    assert prop["zone_code"] == "NX-10"
    assert prop["acreage"] == 39.77
    assert prop["is_active"] is True
    assert "1117" in prop["address"] and "EMMET ST N" in prop["address"]


def test_normalize_property_inactive_flag():
    raw = dict(BASE[0], IsActive=0)
    assert normalize.normalize_property(raw, MARKET_ID)["is_active"] is False


def test_normalize_property_provenance_cites_real_layer():
    prop = normalize.normalize_property(BASE[0], MARKET_ID)
    prov = prop["provenance"]
    assert prov["zone_code"]["source"] == "layer 20"
    assert prov["zone_code"]["confidence"] == "real"


# --- normalize_assessment ---------------------------------------------------

PROP_ID = "22222222-2222-2222-2222-222222222222"


def test_normalize_assessment_current_snapshot():
    raw = {"ParcelNumber": "010001600", "CurrentAssessedValue": 140776100, "OBJECTID": 1}
    a = normalize.normalize_assessment(raw, PROP_ID)
    assert a["property_id"] == PROP_ID
    assert a["assessed_total"] == 140776100
    assert a["year"] is None                 # current-only layer carries no year
    assert a["source"] == "layer 1"
    assert a["source_object_id"] == 1
    assert a["provenance"]["assessed_total"]["source"] == "layer 1"


def test_normalize_all_assessment_history_row():
    raw = {"ParcelNumber": "010006000", "TaxYear": "2026", "LandValue": 492400,
           "ImprovementValue": 1276900, "TotalValue": 1769300, "RecordID_Int": 449}
    a = normalize.normalize_all_assessment(raw, PROP_ID)
    assert a["year"] == 2026                 # TaxYear string -> int
    assert a["assessed_land"] == 492400
    assert a["assessed_improvement"] == 1276900
    assert a["assessed_total"] == 1769300
    assert a["source"] == "layer 2"
    assert a["source_object_id"] == 449
    assert a["provenance"]["assessed_total"]["source"] == "layer 2"


# --- normalize_sale ---------------------------------------------------------

def test_normalize_sale_core_fields():
    raw = {"RecordID_Int": 5, "ParcelNumber": "010001100", "SaleAmount": 18381,
           "SaleDate": 789973200000, "BookPage": "645:681"}
    s = normalize.normalize_sale(raw, PROP_ID)
    assert s["property_id"] == PROP_ID
    assert s["source_record_id"] == 5
    assert s["sale_price"] == 18381
    assert s["sale_date"] == "1995-01-13"    # epoch-ms (local midnight) -> ISO date
    assert s["deed_ref"] == "645:681"
    assert s["source"] == "layer 3"
    assert s["is_arms_length"] is True


def test_normalize_sale_zero_amount_is_not_arms_length():
    raw = {"RecordID_Int": 1, "SaleAmount": 0, "SaleDate": 972273600000, "BookPage": "793:231"}
    assert normalize.normalize_sale(raw, PROP_ID)["is_arms_length"] is False


def test_normalize_sale_null_date_does_not_crash():
    raw = {"RecordID_Int": 9, "SaleAmount": 250000, "SaleDate": None, "BookPage": "x"}
    assert normalize.normalize_sale(raw, PROP_ID)["sale_date"] is None


def test_normalize_sale_1900_placeholder_treated_as_null():
    # The county uses 1900-01-01 as a null-date placeholder; left as-is it would skew
    # tenure_years (~125y) and corrupt the financing signal. Must become None.
    raw = {"RecordID_Int": 7, "SaleAmount": 300000, "SaleDate": -2208988800000, "BookPage": "x"}
    assert normalize.normalize_sale(raw, PROP_ID)["sale_date"] is None


# --- normalize_residential (layer 17, all string fields) --------------------

def test_normalize_residential_parses_string_fields():
    raw = {"ParcelNumber": "010006000", "Bedrooms": "6", "FullBathrooms": "4",
           "HalfBathrooms": "1", "SquareFootageFinishedLiving": "3305", "YearBuilt": "1940"}
    r = normalize.normalize_residential(raw)
    assert r["beds"] == 6
    assert r["baths"] == 4.5            # full + 0.5 * half
    assert r["sqft"] == 3305
    assert r["year_built"] == 1940
    assert r["provenance"]["beds"]["source"] == "layer 17"
    assert r["provenance"]["beds"]["confidence"] == "real"


def test_normalize_residential_blank_fields_are_none():
    raw = {"ParcelNumber": "x", "Bedrooms": "", "FullBathrooms": "",
           "HalfBathrooms": "", "SquareFootageFinishedLiving": "", "YearBuilt": ""}
    r = normalize.normalize_residential(raw)
    assert r["beds"] is None and r["baths"] is None
    assert r["sqft"] is None and r["year_built"] is None
