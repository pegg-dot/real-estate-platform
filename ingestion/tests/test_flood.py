"""TDD for FEMA flood-zone parsing (the risk_profile enrichment)."""
from ingestion import flood


def test_high_risk_zones():
    for z in ("A", "AE", "AO", "AH", "VE", "V"):
        assert flood.is_high_risk(z) is True, z
    for z in ("X", "X500", None, ""):
        assert flood.is_high_risk(z) is False, z


def test_parse_minimal_when_no_polygon_intersects():
    r = flood.parse_flood_response({"features": []})
    assert r["flood_zone"] == "X"
    assert r["high_risk"] is False


def test_parse_high_risk_ae_zone():
    r = flood.parse_flood_response(
        {"features": [{"attributes": {"FLD_ZONE": "AE", "ZONE_SUBTY": None}}]})
    assert r["flood_zone"] == "AE"
    assert r["high_risk"] is True
    assert r["provenance"]["source"] == "FEMA NFHL"
