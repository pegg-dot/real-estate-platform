"""TDD for geocoding (real lat/lng via Charlottesville's composite_locator_WGS).

The base parcel layers are non-spatial (no geometry), so coordinates come from the city
locator. The response PARSER is pure and tested here on a captured fixture; the network
call is a thin wrapper. attach_geocode takes an injected geocoder so it's testable with no
network.
"""
import json
import pathlib

from ingestion import geocode

FIX = pathlib.Path(__file__).parent / "fixtures"
RESPONSE = json.loads((FIX / "geocode_1305grady.json").read_text())  # 1305 Grady Ave, score 100


def test_parse_candidates_returns_best_lat_lng_and_score():
    g = geocode.parse_candidates(RESPONSE)
    assert g["score"] == 100
    assert round(g["lat"], 5) == 38.03995      # y
    assert round(g["lng"], 5) == -78.49554     # x


def test_parse_candidates_rejects_below_min_score():
    weak = {"candidates": [{"score": 70, "location": {"x": -78.4, "y": 38.0}}]}
    assert geocode.parse_candidates(weak, min_score=90) is None


def test_parse_candidates_empty_is_none():
    assert geocode.parse_candidates({"candidates": []}) is None


def test_attach_geocode_sets_lat_lng_and_provenance():
    def stub(addr):
        assert addr == "1305 Grady Ave"
        return {"lat": 38.039952, "lng": -78.495544, "score": 100}
    prop = {"address": "1305 Grady Ave", "provenance": {}}
    out = geocode.attach_geocode(prop, geocoder=stub)
    assert out["lat"] == 38.039952 and out["lng"] == -78.495544
    assert out["provenance"]["lat"]["source"] == "composite_locator_WGS"
    assert out["provenance"]["lat"]["confidence"] == "real"   # score 100 -> exact


def test_attach_geocode_no_address_is_noop():
    out = geocode.attach_geocode({"address": None, "provenance": {}}, geocoder=lambda a: 1 / 0)
    assert out["lat"] is None and out["lng"] is None
