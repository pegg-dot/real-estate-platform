"""TDD for distress-signal classification + parsing (spec 012, free MyCvilleRequests source)."""
from ingestion import distress


def test_classify_distress_types():
    assert distress.classify_request("Overgrown Landscape") == ("overgrown_landscape", "medium")
    assert distress.classify_request("Abandoned Vehicle") == ("abandoned_vehicle", "low")


def test_classify_ignores_non_distress_requests():
    for t in ("Pothole", "Snow Removal", "Bike Lane Safety", "", None):
        assert distress.classify_request(t) is None


def test_addr_key_normalizes_number_and_street_for_matching():
    # number + 'GROVE ST' and a full 'GROVE STREET' canonicalize to the same key
    a = distress.addr_key("1105", "GROVE ST")
    b = distress.addr_key("1105", "GROVE STREET")
    assert a == b
    assert "1105" in a


def test_parse_request_returns_signal_for_a_distress_type():
    attrs = {
        "RequestTypeName": "Overgrown Landscape",
        "GeoLocationStreetNumber": "1105", "GeoLocationStreetName": "GROVE ST",
        "DateCreated": 1_700_000_000_000, "GeoLocationLatitude": 38.04, "GeoLocationLongitude": -78.49,
        "RequestID": "R123",
    }
    r = distress.parse_request(attrs)
    assert r is not None
    assert r["signal_type"] == "overgrown_landscape"
    assert r["severity"] == "medium"
    assert "1105" in r["addr_key"]
    assert r["observed_at"] is not None


def test_parse_request_returns_none_for_non_distress():
    assert distress.parse_request({"RequestTypeName": "Pothole"}) is None
