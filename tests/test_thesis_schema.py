"""Locks ADR 0001 #4: config/thesis.example.json is a seed that MUST validate against
config/thesis.schema.json, and the schema must enforce the contract specs 001/003 rely on.
"""
import json
import pathlib

import jsonschema
import pytest

REPO = pathlib.Path(__file__).resolve().parents[1]
SCHEMA = json.loads((REPO / "config" / "thesis.schema.json").read_text())
EXAMPLE = json.loads((REPO / "config" / "thesis.example.json").read_text())


def test_schema_is_valid_draft202012():
    jsonschema.Draft202012Validator.check_schema(SCHEMA)


def test_example_validates_against_schema():
    jsonschema.validate(EXAMPLE, SCHEMA)


def test_scoring_weights_sum_to_one():
    # JSON Schema can't express this cross-field rule; the compiler (spec 001) enforces it.
    assert round(sum(EXAMPLE["scoring_weights"].values()), 6) == 1.0


def test_schema_rejects_unknown_top_level_key():
    bad = dict(EXAMPLE, surprise=True)
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(bad, SCHEMA)


def test_schema_requires_guardrails_flag_true():
    bad = json.loads(json.dumps(EXAMPLE))
    bad["financing"]["always_surface_legal_guardrails"] = False
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(bad, SCHEMA)
