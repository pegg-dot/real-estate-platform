"""Owner ingest (spec 002): owner name/mailing -> is_absentee + entity_type.

Source: NDS_parcel_relate/MapServer/1 (CVGIS.CITY.VW_NDSMOBILE_PIN_DETAILS), keyed by
ParcelNumber, carrying both the OWNER mailing address and the PROPERTY address.

- entity_type drives the financing engine (spec 004): a revocable TRUST gets genuine
  Garn-St.-Germain due-on-sale protection; an LLC cannot use the Dodd-Frank 1-property
  seller-finance exclusion. person/llc/trust/estate are first-class.
- is_absentee (owner mailing != property address) is the core off-market-leads signal
  (the "tired landlord" / likely-seller detection).

Pure functions are unit-tested; `fetch_owners` is a thin network wrapper.
"""
from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request

OWNER_TABLE = ("https://gisweb.charlottesville.org/arcgis/rest/services/"
               "NDS_parcel_relate/MapServer/1/query")


def _norm(s) -> str:
    """Uppercase, collapse whitespace, drop punctuation."""
    return re.sub(r"[^A-Z0-9 ]", "", re.sub(r"\s+", " ", (s or "").upper())).strip()


# institutions/government — non-targets; must not be mislabeled as a buyable 'llc'.
_INSTITUTION = ("RECTOR", "UNIVERSITY", "CITY", "COUNTY", "COMMONWEALTH", "STATE",
                "AUTHORITY", "CHURCH", "FOUNDATION", "SCHOOL", "COLLEGE", "HOSPITAL")
# commercial entity (treated as ONE bucket — the financing engine (spec 004) keys
# Dodd-Frank/Garn eligibility off person-vs-trust-vs-entity, not LP-vs-LLC-vs-corp).
_ENTITY = ("LLC", "L L C", "INC", "CORP", "CO", "COMPANY", "LP", "LLP",
           "PARTNERSHIP", "LTD", "ASSOCIATION", "BANK", "PROPERTIES", "INVESTMENTS")


def infer_entity_type(name: str) -> str:
    """Classify an owner name (person/llc/trust/estate/institution/unknown) from tokens.
    `llc` is the generic commercial-entity bucket; institutions are flagged separately so
    they can be excluded from the lead pool."""
    n = _norm(name)
    if not n:
        return "unknown"                  # missing name -> NOT asserted as a person
    if n.startswith("ESTATE OF") or re.search(r"\bESTATE\b", n):
        return "estate"
    if "TRUST" in n or re.search(r"\bTR\b", n) or "REVOCABLE" in n:
        return "trust"
    if any(re.search(rf"\b{re.escape(t)}\b", n) for t in _INSTITUTION):
        return "institution"
    if any(re.search(rf"\b{re.escape(t)}\b", n) for t in _ENTITY):
        return "llc"
    return "person"


# street-type abbreviation expansions so "ST" and "STREET" compare equal
_STREET_ABBR = {"ST": "STREET", "RD": "ROAD", "AVE": "AVENUE", "DR": "DRIVE",
                "LN": "LANE", "CT": "COURT", "PL": "PLACE", "BLVD": "BOULEVARD",
                "CIR": "CIRCLE", "TER": "TERRACE", "HWY": "HIGHWAY", "PKWY": "PARKWAY",
                "SQ": "SQUARE", "TRL": "TRAIL"}
_UNIT_TOKENS = {"APT", "UNIT", "STE", "SUITE", "FL", "FLOOR", "#"}


def _street_key(text: str) -> str:
    """Canonical street key: house number + name with abbreviations expanded and unit
    tokens dropped, so formatting drift ('ST' vs 'STREET') doesn't read as a new address."""
    toks = _norm(text).split()
    out = []
    skip_next = False
    for t in toks:
        if skip_next:
            skip_next = False
            continue
        if t in _UNIT_TOKENS:             # drop "STE 200", "FL 29", "APT B"
            skip_next = True
            continue
        out.append(_STREET_ABBR.get(t, t))
    return " ".join(out)


def is_absentee(row: dict) -> bool:
    """True when the owner's mailing street differs from the property street (absentee).
    Compares abbreviation-normalized house-number+street so 'ST'/'STREET' don't misread."""
    prop_street = _street_key(f"{row.get('st_number', '')} {row.get('st_name', '')}")
    owner_street = _street_key(row.get("OwnerAddress"))
    if not owner_street or not prop_street.strip():
        return False                      # can't tell -> don't assert absentee
    return owner_street != prop_street


def normalize_owner(row: dict) -> dict:
    """Map an owner-table row to an `owner` record (name, mailing, entity_type, absentee)."""
    name = (row.get("OwnerName") or "").strip()
    mailing = " ".join(p for p in (
        (row.get("OwnerAddress") or "").strip(),
        (row.get("OwnerCityState") or "").strip(),
        (row.get("OwnerZipCode") or "").strip(),
    ) if p)
    src = {"source": "NDS_parcel_relate table 1", "confidence": "real"}
    return {
        "name": name or None,
        "mailing_address": mailing or None,
        "entity_type": infer_entity_type(name),
        "is_absentee": is_absentee(row),
        "provenance": {"name": src, "mailing_address": src, "is_absentee": src},
    }


def fetch_owners(parcels) -> list:
    """Network: fetch owner rows for the given ParcelNumbers (raw attribute dicts)."""
    from ingestion import charlottesville as cv

    out = []
    fields = ("ParcelNumber,GPIN,OwnerName,OwnerAddress,OwnerCityState,OwnerZipCode,"
              "st_number,st_name,st_unit")
    for clause in cv.build_parcel_filters(parcels):
        params = {"where": clause, "outFields": fields, "orderByFields": "OBJECTID",
                  "f": "json", "resultRecordCount": 1000}
        # POST so a large ParcelNumber IN (...) can't overflow the URL length limit (404)
        body = urllib.parse.urlencode(params).encode("utf-8")
        req = urllib.request.Request(OWNER_TABLE, data=body, headers={
            "User-Agent": "LOT-ingest/0.1", "Content-Type": "application/x-www-form-urlencoded"})
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        out.extend(f.get("attributes", {}) for f in data.get("features", []))
    return out
