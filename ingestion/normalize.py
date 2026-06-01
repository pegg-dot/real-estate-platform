"""Pure normalization for Charlottesville ingest (spec 002).

Transforms raw ArcGIS attribute dicts (base / assessments / sales layers) into records
shaped for the unified schema in supabase/migrations/0001_core_schema.sql. Every value is
tagged real-vs-modeled via a `provenance` map (ADR 0001 #5): real source fields cite
their ArcGIS layer; derived fields record how they were computed and a confidence level.

No network, no DB — these are pure functions, unit-tested against captured fixtures.
"""
from __future__ import annotations

import datetime
from collections import defaultdict


def _real(source: str) -> dict:
    """Provenance entry for a value pulled directly from a primary source."""
    return {"source": source, "confidence": "real"}


def _str_or_none(v) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def normalize_property(raw: dict, market_id: str) -> dict:
    """Map a base-layer (layer 20) parcel row to a `property` record."""
    street_number = (raw.get("StreetNumber") or "").strip()
    street_name = (raw.get("StreetName") or "").strip()
    unit = (raw.get("Unit") or "").strip()
    address = " ".join(p for p in (street_number, street_name) if p)
    if unit:
        address = f"{address} #{unit}"

    return {
        "market_id": market_id,
        "apn": _str_or_none(raw.get("ParcelNumber")),
        "gpin": _str_or_none(raw.get("GPIN")),
        "address": address or None,
        "acreage": raw.get("Acreage"),
        "zone_code": _str_or_none(raw.get("Zone")),
        "legal_desc": _str_or_none(raw.get("Legal")),
        "tax_district": _str_or_none(raw.get("TaxDist")),
        "is_active": bool(raw.get("IsActive")),
        "provenance": {
            "zone_code": _real("layer 20"),
            "apn": _real("layer 20"),
            "gpin": _real("layer 20"),
            "acreage": _real("layer 20"),
            "address": _real("layer 20"),
        },
    }


def _int_or_none(v) -> int | None:
    s = (str(v).strip() if v is not None else "")
    try:
        return int(s) if s else None
    except ValueError:
        return None


def normalize_residential(raw: dict) -> dict:
    """Map a Residential Details (layer 17) row to physical fields. All source fields are
    strings ('' = unknown); these are REAL beds/baths/sqft (replaces modeled estimates)."""
    full = _int_or_none(raw.get("FullBathrooms"))
    half = _int_or_none(raw.get("HalfBathrooms"))
    baths = None if (full is None and half is None) else (full or 0) + 0.5 * (half or 0)
    return {
        "beds": _int_or_none(raw.get("Bedrooms")),
        "baths": baths,
        "sqft": _int_or_none(raw.get("SquareFootageFinishedLiving")),
        "year_built": _int_or_none(raw.get("YearBuilt")),
        "provenance": {
            "beds": _real("layer 17"),
            "baths": _real("layer 17"),
            "sqft": _real("layer 17"),
            "year_built": _real("layer 17"),
        },
    }


def _epoch_ms_to_iso_date(ms) -> str | None:
    """ArcGIS esriFieldTypeDate is epoch-ms. The county stores local-midnight, so the
    UTC date equals the intended calendar date. Returns 'YYYY-MM-DD' or None.

    Dates in 1900 or earlier are the county's null-date placeholder (not real sales) and
    are treated as None so they can't skew tenure_years / the financing signal.
    """
    if ms is None:
        return None
    d = datetime.datetime.utcfromtimestamp(ms / 1000).date()
    if d.year <= 1900:
        return None
    return d.isoformat()


def normalize_assessment(raw: dict, property_id: str) -> dict:
    """Map a Current-Assessments (layer 1) row to an `assessment` record.

    This layer is current-only: it has CurrentAssessedValue + OBJECTID but no
    land/improvement split and no year, so `year` is None (a current snapshot).
    """
    return {
        "property_id": property_id,
        "year": None,
        "assessed_land": None,
        "assessed_improvement": None,
        "assessed_total": raw.get("CurrentAssessedValue"),
        "source": "layer 1",
        "source_object_id": raw.get("OBJECTID"),
        "provenance": {"assessed_total": _real("layer 1")},
    }


def normalize_sale(raw: dict, property_id: str) -> dict:
    """Map a Sales (layer 3) row to a `sale` record."""
    price = raw.get("SaleAmount")
    return {
        "property_id": property_id,
        "source_record_id": raw.get("RecordID_Int"),
        "sale_date": _epoch_ms_to_iso_date(raw.get("SaleDate")),
        "sale_price": price,
        "grantor": None,   # not in the sales layer; comes from owner/deed layer later
        "grantee": None,
        "deed_ref": _str_or_none(raw.get("BookPage")),
        "is_arms_length": bool(price and price > 0),
        "source": "layer 3",
        "provenance": {
            "sale_price": _real("layer 3"),
            "sale_date": _real("layer 3"),
        },
    }


def _years_between(iso_date: str, as_of: datetime.date) -> float:
    d = datetime.date.fromisoformat(iso_date)
    return round((as_of - d).days / 365.25, 2)


def assemble_properties(base_rows, assess_rows, sale_rows, market_id,
                        as_of: datetime.date | None = None,
                        residential_rows=None) -> list[dict]:
    """Join base + assessments + sales (+ optional residential details) by ParcelNumber
    into one record per parcel.

    Attaches the current `assessment`, the parcel's `sales` (oldest->newest), the most
    recent `last_sale`, a modeled `est_market_value` baseline, the derived `tenure_years`
    (years since the most recent ARM'S-LENGTH sale — the current owner's real acquisition;
    non-arm's-length transfers are ignored), and, when `residential_rows` are supplied,
    REAL `beds`/`baths`/`sqft`/`year_built` from layer 17. `as_of` is injected so the
    derivation is deterministic and testable.
    """
    as_of = as_of or datetime.date.today()
    assess_by_pn = {r.get("ParcelNumber"): r for r in assess_rows}
    res_by_pn = {r.get("ParcelNumber"): r for r in (residential_rows or [])}
    sales_by_pn: dict[str, list] = defaultdict(list)
    for r in sale_rows:
        sales_by_pn[r.get("ParcelNumber")].append(r)

    out = []
    for raw in base_rows:
        pn = raw.get("ParcelNumber")
        prop = normalize_property(raw, market_id)

        araw = assess_by_pn.get(pn)
        assessment = normalize_assessment(araw, None) if araw else None

        sales = [normalize_sale(s, None) for s in sales_by_pn.get(pn, [])]
        sales = sorted((s for s in sales if s["sale_date"]), key=lambda s: s["sale_date"])
        last_sale = sales[-1] if sales else None

        arms = [s for s in sales if s["is_arms_length"]]
        last_arms = arms[-1] if arms else None
        tenure = _years_between(last_arms["sale_date"], as_of) if last_arms else None

        est_mv = assessment["assessed_total"] if assessment else None

        prop.update({
            "assessment": assessment,
            "sales": sales,
            "last_sale": last_sale,
            "est_market_value": est_mv,
            "tenure_years": tenure,
        })

        rraw = res_by_pn.get(pn)
        if rraw is not None:
            res = normalize_residential(rraw)
            prop["beds"] = res["beds"]
            prop["baths"] = res["baths"]
            prop["sqft"] = res["sqft"]
            prop["year_built"] = res["year_built"]
            prop["provenance"].update(res["provenance"])
        as_of_iso = as_of.isoformat()
        if est_mv is not None:
            prop["provenance"]["est_market_value"] = {
                "source": "baseline = current assessed_total",
                "confidence": "estimated", "as_of": as_of_iso}
        if tenure is not None:
            prop["provenance"]["tenure_years"] = {
                "source": "derived: as_of - most recent arm's-length sale",
                "confidence": "modeled", "as_of": as_of_iso}
        out.append(prop)
    return out
