"""TDD for owner ingest (spec 002 Behavior #1-3): owner name/mailing -> is_absentee +
entity_type. Source: NDS_parcel_relate table 1 (VW_NDSMOBILE_PIN_DETAILS), which carries
both the OWNER mailing address and the PROPERTY address, so absentee is computable.

entity_type feeds the financing engine (trust = Garn-St.-Germain; LLC can't use the
1-property Dodd-Frank exclusion). is_absentee feeds the off-market leads layer.
"""
import json
import pathlib

from ingestion import owner

FIX = pathlib.Path(__file__).parent / "fixtures"
OWNERS = json.loads((FIX / "owner_sample.json").read_text())


def test_infer_entity_type():
    assert owner.infer_entity_type("MILLMONT LIMITED PARTNERSHIP") == "llc"  # commercial-entity bucket
    assert owner.infer_entity_type("CWP-ASR CHARLOTTESVILLE I LLC") == "llc"
    assert owner.infer_entity_type("FEDERAL REALTY INVESTMENT TR") == "trust"
    assert owner.infer_entity_type("JONES FAMILY TRUST") == "trust"
    assert owner.infer_entity_type("ESTATE OF JANE DOE") == "estate"
    assert owner.infer_entity_type("SMITH JOHN A") == "person"


def test_infer_entity_type_institution_not_llc():
    # UVA, the City, etc. are non-targets — must NOT be mislabeled 'llc' (pollutes leads)
    assert owner.infer_entity_type("THE RECTOR & VISITORS OF THE UNIVERSITY OF VIRGINIA") == "institution"
    assert owner.infer_entity_type("CITY OF CHARLOTTESVILLE") == "institution"


def test_infer_entity_type_blank_is_unknown_not_person():
    # a missing name must not be asserted as a Dodd-Frank/Garn-eligible 'person'
    assert owner.infer_entity_type("") == "unknown"
    assert owner.infer_entity_type(None) == "unknown"


def test_is_absentee_true_when_mailing_differs_from_property():
    row = {"st_number": "1159", "st_name": "MILLMONT ST",
           "OwnerAddress": "500 WESTFIELD RD"}
    assert owner.is_absentee(row) is True


def test_is_absentee_false_for_owner_occupant():
    row = {"st_number": "1159", "st_name": "MILLMONT ST",
           "OwnerAddress": "1159 MILLMONT ST"}
    assert owner.is_absentee(row) is False


def test_is_absentee_false_despite_abbreviation_drift():
    # same address, "ST" vs "STREET" — must NOT be flagged absentee (false lead)
    row = {"st_number": "1159", "st_name": "MILLMONT STREET",
           "OwnerAddress": "1159 MILLMONT ST"}
    assert owner.is_absentee(row) is False


def test_is_absentee_true_for_different_house_number_same_street():
    row = {"st_number": "1117", "st_name": "EMMET ST N",
           "OwnerAddress": "1136 EMMET ST N"}
    assert owner.is_absentee(row) is True


def test_normalize_owner_core_fields():
    row = next(r for r in OWNERS if r["ParcelNumber"] == "010001200")  # Millmont LP
    o = owner.normalize_owner(row)
    assert "MILLMONT" in o["name"]
    assert o["entity_type"] == "llc"
    assert o["is_absentee"] is True
    assert "500 WESTFIELD RD" in o["mailing_address"]
    assert o["provenance"]["name"]["source"].startswith("NDS")
