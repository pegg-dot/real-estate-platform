"""Tests for the ArcGIS query-building layer of the Charlottesville ingestion client.

Regression: the assessments layer (1) has no RecordID_Int field, so a hardcoded
orderByFields=RecordID_Int makes ArcGIS return an error (0 features). Each layer must
order by a field it actually has (verified live: base/sales -> RecordID_Int,
assessments -> OBJECTID).
"""
from ingestion import charlottesville as cv


def test_assessments_layer_orders_by_objectid_not_recordid():
    # assessments (layer 1) has OBJECTID but NOT RecordID_Int
    cfg = cv.layer_config("assessments")
    assert cfg["id"] == 1
    assert cfg["order"] == "OBJECTID"


def test_base_and_sales_order_by_recordid():
    assert cv.layer_config("base")["order"] == "RecordID_Int"
    assert cv.layer_config("sales")["order"] == "RecordID_Int"


def test_residential_and_all_assessments_layers_registered():
    # layers 17 (Residential Details -> real beds) and 2 (All Assessments -> history)
    # both expose RecordID_Int (NOT OBJECTID), so they must be registered, not left to
    # the numeric-id passthrough which would default to OBJECTID and return 0 rows.
    assert cv.layer_config("residential") == {"id": 17, "order": "RecordID_Int"}
    assert cv.layer_config("all_assessments") == {"id": 2, "order": "RecordID_Int"}


def test_build_query_params_uses_layer_order_field():
    params = cv.build_query_params("assessments", where="1=1", offset=0, count=10)
    assert params["orderByFields"] == "OBJECTID"
    assert params["where"] == "1=1"
    assert params["resultOffset"] == 0
    assert params["resultRecordCount"] == 10
    assert params["f"] == "json"
    assert params["returnGeometry"] == "false"


# --- parcel IN-filter building (injection-safe) -----------------------------

def test_parcel_filters_quotes_clean_values():
    assert cv.build_parcel_filters(["010001000", "010001100"]) == [
        "ParcelNumber IN ('010001000','010001100')"
    ]


def test_parcel_filters_drops_injection_and_malformed_values():
    # external (county-API) input must not be able to alter the WHERE clause
    out = cv.build_parcel_filters(["x') OR 1=1 --", "010001000", "has space", "a'b"])
    assert out == ["ParcelNumber IN ('010001000')"]


def test_parcel_filters_chunks_to_respect_url_limits():
    parcels = [f"{i:09d}" for i in range(450)]
    out = cv.build_parcel_filters(parcels, chunk=200)
    assert len(out) == 3                       # 200 + 200 + 50
    assert out[0].count(",") == 199            # 200 values -> 199 commas
    assert out[2].count(",") == 49


def test_parcel_filters_empty_returns_empty_list():
    assert cv.build_parcel_filters([]) == []
