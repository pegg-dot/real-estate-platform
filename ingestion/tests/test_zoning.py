"""TDD for by-the-room legality attach (spec 002 Behavior #4) — the make-or-break field.

Legality is curated + cited (config/zoning/<market>.json), never fabricated: an exact
zone override wins, else the market default, else 'unknown' (flagged for a zoning
determination). Every attached value carries the stability_flag and is tagged 'modeled'
(never 'real'), per CLAUDE.md golden rules #3 and #4.
"""
import pathlib

from ingestion import zoning

CVILLE = pathlib.Path(__file__).resolve().parents[2] / "config" / "zoning" / "charlottesville.json"


def test_shipped_charlottesville_config_is_cited_and_caveated():
    rules = zoning.load_zoning_rules(CVILLE)
    assert rules["default"]["by_room_legal"] is True
    assert rules["default"]["max_unrelated_occupants"] is None
    assert rules["source_url"]
    assert "White v. City of Charlottesville" in rules["stability_flag"]


def test_attach_uses_market_default_for_a_residential_zone():
    rules = zoning.load_zoning_rules(CVILLE)
    prop = {"zone_code": "RX-5", "provenance": {}}
    out = zoning.attach_zoning(prop, rules)
    assert out["by_room_legal"] is True
    assert out["max_unrelated_occupants"] is None
    assert out["zoning"]["stability_flag"]          # caveat always present
    assert out["provenance"]["by_room_legal"]["confidence"] == "modeled"  # never 'real'


def test_attach_prefers_explicit_zone_override_over_default():
    rules = {
        "source_url": "x", "as_of_date": "2024-01-01", "stability_flag": "s",
        "default": {"by_room_legal": True, "max_unrelated_occupants": None},
        "zones": {"IND-1": {"by_room_legal": False, "max_unrelated_occupants": 0,
                            "note": "industrial — no dwellings"}},
    }
    out = zoning.attach_zoning({"zone_code": "IND-1", "provenance": {}}, rules)
    assert out["by_room_legal"] is False
    assert out["max_unrelated_occupants"] == 0


def test_attach_unknown_market_flags_for_determination_not_assumed_legal():
    # No rules / no default -> must NOT assume legal; flag it.
    out = zoning.attach_zoning({"zone_code": "ZZZ", "provenance": {}}, rules=None)
    assert out["by_room_legal"] is None
    assert out["provenance"]["by_room_legal"]["confidence"] == "unknown"
    assert "determination" in out["zoning"]["note"].lower()
