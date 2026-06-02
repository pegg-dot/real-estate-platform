"""By-the-room legality attach (spec 002 Behavior #4) — the make-or-break legal field.

Legality is CURATED + CITED in config/zoning/<market>.json, never inferred from the
parcel feed. Lookup precedence: explicit per-zone override -> market default -> unknown.
An unknown zone is NOT assumed legal — it is flagged for a zoning determination. Every
attached value carries the market's stability_flag and is tagged confidence='modeled'
(never 'real'/settled), honoring CLAUDE.md golden rules #3 (legality first-class) and #4
(legal guardrails are a feature; never present as risk-free). Informational, not legal
advice — defer to the zoning-analyst subagent / a land-use attorney for any deal that
hinges on occupancy legality.
"""
from __future__ import annotations

import json


def load_zoning_rules(path) -> dict:
    """Load a market's curated zoning rules from its config JSON."""
    with open(path) as fh:
        return json.load(fh)


def attach_zoning(prop: dict, rules: dict | None) -> dict:
    """Attach by_room_legal / max_unrelated_occupants (+ a cited, caveated `zoning` block)
    to a property record, based on its zone_code. Mutates and returns `prop`."""
    zone = prop.get("zone_code")
    prop.setdefault("provenance", {})

    rule = None
    if rules:
        rule = (rules.get("zones") or {}).get(zone) or rules.get("default")

    if rule is None:
        prop["by_room_legal"] = None
        prop["max_unrelated_occupants"] = None
        prop["str_allowed"] = None          # unknown zone -> STR not assumed legal either
        prop["zoning"] = {
            "zone_code": zone,
            "by_room_legal": None,
            "str_allowed": None,
            "note": "Unknown zone — needs a per-parcel zoning determination; "
                    "by-room legality is NOT assumed.",
        }
        prop["provenance"]["by_room_legal"] = {"source": "none", "confidence": "unknown"}
        return prop

    prop["by_room_legal"] = rule.get("by_room_legal")
    prop["max_unrelated_occupants"] = rule.get("max_unrelated_occupants")
    prop["str_allowed"] = rule.get("str_allowed")   # STR zoning gate (spec 019); None = unknown
    prop["zoning"] = {
        "zone_code": zone,
        "by_room_legal": rule.get("by_room_legal"),
        "str_allowed": rule.get("str_allowed"),
        "max_unrelated_occupants": rule.get("max_unrelated_occupants"),
        "rooming_house_allowed": rule.get("rooming_house_allowed"),
        "stability_flag": rules.get("stability_flag"),
        "source_url": rules.get("source_url"),
        "as_of_date": rules.get("as_of_date"),
        "note": rule.get("note", ""),
    }
    prop["provenance"]["by_room_legal"] = {
        "source": rules.get("source_url"),
        "confidence": "modeled",                 # cited but litigated -> never 'real'
        "as_of": rules.get("as_of_date"),
    }
    return prop
