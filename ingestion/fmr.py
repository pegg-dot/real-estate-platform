"""HUD Fair Market Rent refresh (spec 007 / Phase 4 004a) — REAL, free rent-floor data.

HUD FMR is the 40th-percentile gross rent by bedroom, published per metro (CBSA). LOT uses
it as a defensible FLOOR / sanity cross-check on the modeled whole-house rent — never as the
student-rental headline (the voucher number understates near-campus market rent).

This is the annual-refresh tool. The FY2026 Charlottesville numbers are already baked into
config/market-assumptions/charlottesville.json, so scoring works WITHOUT a token. Run this
yearly (or for a new market) with a free HUD token to pull the new vintage:

    HUD_API_TOKEN=... python -m ingestion.fmr        # live fetch, prints the config block
    python -m ingestion.fmr                          # no token -> prints the published fallback

CRITICAL geography note: Charlottesville city (FIPS 51540) and Albemarle County (51003) share
ONE metro CBSA (16820). Always query the METRO code, never a county FIPS — a county FIPS loads
the wrong-or-nonexistent FMR. assert_area_matches() is the guardrail (it checks the area NAME).
"""
from __future__ import annotations

import json
import os
import urllib.request

HUD_API = "https://www.huduser.gov/hudapi/public/fmr/data"
CHARLOTTESVILLE_CBSA = "16820"  # Charlottesville, VA MSA (city + Albemarle share it)

# HUD FMR bedroom field names -> our integer bedroom count
_BR_KEYS = [("Efficiency", 0), ("One-Bedroom", 1), ("Two-Bedroom", 2),
            ("Three-Bedroom", 3), ("Four-Bedroom", 4)]


def hud_entity_id(cbsa: str) -> str:
    """HUD FMR API entity id for a metro area = METRO{cbsa}M{cbsa}."""
    return f"METRO{cbsa}M{cbsa}"


def parse_fmr_response(data: dict) -> dict:
    """Extract {cbsa_name, by_bedroom{0..4}, year} from a HUD FMR API response. Metro queries
    return basicdata as an object; state queries return a list — handle both."""
    d = data.get("data", {})
    bd = d.get("basicdata", {})
    if isinstance(bd, list):
        bd = bd[0] if bd else {}
    by_bedroom = {br: bd[key] for key, br in _BR_KEYS if bd.get(key) is not None}
    return {"cbsa_name": d.get("metro_name") or d.get("county_name"),
            "by_bedroom": by_bedroom, "year": bd.get("year")}


def assert_area_matches(parsed: dict, expect: str) -> None:
    """Guardrail against the county-FIPS-vs-CBSA trap: the resolved area NAME must contain the
    expected market, else we silently loaded the wrong geography's rents."""
    name = parsed.get("cbsa_name") or ""
    if expect.lower() not in name.lower():
        raise ValueError(
            f"HUD FMR area '{name}' does not contain expected '{expect}' — wrong CBSA/FIPS? "
            f"Charlottesville is metro CBSA {CHARLOTTESVILLE_CBSA}, NOT a county FIPS.")


# Published FY2026 fallback (no token needed) — mirrors config/market-assumptions/charlottesville.json
FY2026_CHARLOTTESVILLE = {
    "cbsa_name": "Charlottesville, VA MSA", "year": 2026,
    "by_bedroom": {0: 1421, 1: 1602, 2: 1824, 3: 2218, 4: 2731},
}


def fetch_fmr(token: str, cbsa: str = CHARLOTTESVILLE_CBSA, year: int | None = None) -> dict:
    """Network: fetch + parse the HUD FMR for a metro CBSA (Bearer token required)."""
    url = f"{HUD_API}/{hud_entity_id(cbsa)}"
    if year:
        url += f"?year={year}"
    req = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {token}", "User-Agent": "LOT-ingest/0.1"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return parse_fmr_response(json.loads(resp.read().decode("utf-8")))


def _config_block(parsed: dict) -> dict:
    return {"cbsaName": parsed["cbsa_name"], "fmrYear": parsed["year"],
            "sourceUrl": "https://www.huduser.gov/portal/datasets/fmr.html",
            "upliftFactorAbove4": 0.15,
            "byBedroom": {str(k): v for k, v in sorted(parsed["by_bedroom"].items())}}


def main() -> None:
    token = os.environ.get("HUD_API_TOKEN")
    if token:
        parsed = fetch_fmr(token, year=2026)
        assert_area_matches(parsed, "Charlottesville")
        print("Fetched LIVE HUD FMR (Charlottesville MSA):")
    else:
        parsed = FY2026_CHARLOTTESVILLE
        print("No HUD_API_TOKEN set — showing the published FY2026 fallback (already in config):")
    print(json.dumps(parsed, indent=2))
    print("\nPaste into config/market-assumptions/<market>.json under \"fmr\":")
    print(json.dumps(_config_block(parsed), indent=2))


if __name__ == "__main__":
    main()
