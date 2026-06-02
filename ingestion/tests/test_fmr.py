"""TDD for the HUD FMR refresh tool (spec 007 / Phase 4 004a — real rent floor)."""
import pytest

from ingestion import fmr

# a HUD FMR API response for a METRO area (basicdata is an object for metros)
SAMPLE_METRO = {"data": {
    "metro_name": "Charlottesville, VA MSA", "metro_status": "1",
    "basicdata": {"Efficiency": 1421, "One-Bedroom": 1602, "Two-Bedroom": 1824,
                  "Three-Bedroom": 2218, "Four-Bedroom": 2731, "year": 2026}}}


def test_hud_entity_id_metro_format():
    # HUD FMR API metro entity id = METRO{cbsa}M{cbsa}
    assert fmr.hud_entity_id("16820") == "METRO16820M16820"


def test_parse_extracts_bedrooms_and_area_name():
    r = fmr.parse_fmr_response(SAMPLE_METRO)
    assert r["cbsa_name"] == "Charlottesville, VA MSA"
    assert r["by_bedroom"] == {0: 1421, 1: 1602, 2: 1824, 3: 2218, 4: 2731}
    assert r["year"] == 2026


def test_parse_handles_state_array_basicdata():
    # state queries return basicdata as a list; take the first
    data = {"data": {"metro_name": "X", "basicdata": [{"Two-Bedroom": 1000, "year": 2026}]}}
    assert fmr.parse_fmr_response(data)["by_bedroom"] == {2: 1000}


def test_geography_guard_rejects_wrong_area():
    # the whole point of the guard: a county-FIPS mistake loading Richmond must FAIL, not pass
    with pytest.raises(ValueError):
        fmr.assert_area_matches({"cbsa_name": "Richmond, VA MSA"}, expect="Charlottesville")
    # the correct area passes silently
    fmr.assert_area_matches({"cbsa_name": "Charlottesville, VA MSA"}, expect="Charlottesville")


def test_published_fallback_matches_known_fy2026_numbers():
    fb = fmr.FY2026_CHARLOTTESVILLE
    assert "Charlottesville" in fb["cbsa_name"]
    assert fb["by_bedroom"][4] == 2731
    assert fb["by_bedroom"][2] == 1824
