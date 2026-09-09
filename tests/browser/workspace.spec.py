"""Browser regressions for the real interface with explicitly synthetic API fixtures.

Requires Python and playwright. Run against a locally running production/dev web app:
  LOT_UI_BASE=http://127.0.0.1:3000 python tests/browser/workspace.spec.py
No real provider keys, production records, or external sends are used.
"""
import json
import os
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from playwright.sync_api import sync_playwright

BASE = os.environ.get("LOT_UI_BASE", "http://127.0.0.1:3000")
OUT = Path(os.environ.get("LOT_UI_ARTIFACTS", "artifacts/ui"))
OUT.mkdir(parents=True, exist_ok=True)
FEATURES = [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [-78.5036 + i * .001, 38.0356 + i * .0004]}, "properties": {
    "apn": f"DEMO-{i+1:03}", "address": f"{101+i*2} Example {'Lane' if i % 2 else 'Street'}", "score": max(28, 89-i*2),
    "colorValue": max(28, 89-i*2), "price": 385000+i*12500, "coc": .092-i*.001,
    "bestUseCoc": .092-i*.001, "byRoom": i % 3 != 0, "gatePassed": i % 4 != 0,
    "structure": "cash" if i % 2 else "seller_finance", "use": "hold", "distress": i % 5 == 0,
}} for i in range(36)]

def dossier(apn):
    p = next((f["properties"] for f in FEATURES if f["properties"]["apn"] == apn), FEATURES[0]["properties"])
    return {"id": "sample-id", **p, "zone_code": "R-A", "beds": 4, "est_market_value": p["price"], "latest_assessed": 362000,
            "headline_coc": p["coc"], "headline_model": "cash", "coc_low": .061, "coc_high": .104, "data_confidence": .78,
            "gate_failures": [] if p["gatePassed"] else ["Verify permitted occupancy before relying on by-room income.", "Flood evidence requires additional review."],
            "gate_passed": p["gatePassed"], "by_room_legal": p["byRoom"], "owner_name": "Example Owner LLC", "owner_entity_type": "llc",
            "is_absentee": True, "flood_zone": "X", "last_arms_price": 290000, "last_arms_date": "2018-05-10",
            "recommended_use": "hold", "recommended_exit_strategy": "long_term_rental", "components": {
                "cash_flow": {"weight": .35, "weighted": 29.4}, "location": {"weight": .3, "weighted": 24.3},
                "appreciation": {"weight": .2, "weighted": 12.8}, "risk_penalty": {"weight": 1, "weighted": -4.2}},
            "financing": {"recommended": [{"structure": "cash", "buyer": {"cashInDeal": 410000}, "sellerPitch": "Straightforward closing with no financing contingency."},
                 {"structure": "seller_finance", "attorneyReviewRequired": True, "legalGuardrail": "Attorney review required. Confirm lender restrictions and applicable disclosures.", "buyer": {"cashInDeal": 82000}}],
                 "suppressed": [{"structure": "subject_to", "reason": "Existing loan terms are not established."}]},
            "exit_strategies": {"ranked": [{"strategy": "long_term_rental", "cashOnCash": .079, "guardrail": "Verify permitted occupancy."}], "excluded": [{"strategy": "short_term_rental", "reason": "Permit not verified"}]},
            "hbu": {"ranked": [{"use": "hold", "annualizedReturn": .079, "upsideVsHold": 0}], "note": "Modeled screening estimate, not an appraisal."},
            "distress": [{"signal_type": "maintenance_signal", "severity": "medium"}]}

class Fixtures:
    def __init__(self): self.empty = False; self.failure = False; self.action_failure = False; self.calls = []
    def handle(self, route):
        url = urlsplit(route.request.url)
        if not url.path.startswith("/api/"): return route.continue_()
        self.calls.append((url.path, route.request.method, route.request.post_data))
        payload = {"ok": True}
        if url.path == "/api/health": payload = {"ok": True, "db": "reachable", "migrations": 30}
        elif url.path == "/api/me": payload = {"authEnabled": False, "email": None}
        elif url.path == "/api/parcels":
            if self.failure: return route.fulfill(status=503, json={"error": "synthetic data service failure"})
            payload = {"type": "FeatureCollection", "features": [] if self.empty else FEATURES}
        elif url.path == "/api/theses": payload = {"theses": [] if self.empty else [{"version": 3, "mode": "guided", "primary": "cash_flow", "is_active": True}]}
        elif url.path == "/api/automation": payload = {"ok": True, "autoEnabled": False, "lastRefreshAgeDays": None if self.empty else .4, "isDue": False, "triggered": False}
        elif url.path == "/api/brief": payload = {"rows": [] if self.empty else [
            {"queue": "ACT_ON_DEAL", "title": "Review your latest property shortlist", "reason": "A property in your pipeline is ready for the next diligence decision.", "action": "review", "target": "DEMO-002"},
            {"queue": "VERIFY_ZONING", "title": "Verify occupancy before underwriting", "reason": "Two source constraints need a closer look before you rely on modeled income.", "action": "verify", "target": "DEMO-001"}], "summary": "Synthetic test brief"}
        elif url.path == "/api/dossier": payload = dossier(parse_qs(url.query).get("apn", ["DEMO-001"])[0])
        elif url.path == "/api/filter": return route.fulfill(status=503, json={"error": "test unavailable"})
        elif url.path == "/api/actions":
            if self.action_failure: return route.fulfill(status=503, json={"error": "test unavailable"})
            payload = {"ok": True, "output": "Synthetic test dossier. Citations and sensitivity would appear here."}
        elif url.path == "/api/config": payload = {"ok": True, "weekly_mail_budget": 10, "lifetime_mail_cap": 4, "cooldown_days": 90, "outreach_enabled": False, **(json.loads(route.request.post_data) if route.request.method == "POST" else {})}
        elif url.path == "/api/passcode": payload = {"set": True} if route.request.method == "GET" else {"ok": True}
        elif url.path == "/api/run": payload = {"ok": True, "output": "Synthetic command outcome. No real jobs were run."}
        elif url.path == "/api/connect/status": payload = {"configured": False, "connectors": []}
        elif url.path == "/api/owner": payload = {"owner": {"name": "Example Owner LLC", "entity_type": "llc", "is_absentee": True}, "portfolio": {"count": 2, "totalValue": 750000, "byRoomLegal": 1, "distressCount": 0, "parcels": []}, "situation": None, "contact": None, "intel": [], "links": []}
        elif url.path == "/api/interrogate": payload = {"error": "test provider unavailable"}
        route.fulfill(status=200, content_type="application/json", body=json.dumps(payload))

def screenshot(page, name):
    # Label the evidence, not the product: this badge is only inserted by the test runner.
    page.evaluate("""() => { let e = document.getElementById('qa-data-label'); if(!e) { e=document.createElement('div'); e.id='qa-data-label'; e.textContent='UI TEST / SYNTHETIC DATA'; e.style.cssText='position:fixed;bottom:8px;left:8px;z-index:2147483647;padding:5px 8px;background:#212922;color:#d5e7c8;font:9px monospace;border:1px solid #50604f;border-radius:4px;pointer-events:none'; document.body.appendChild(e); } }""")
    page.screenshot(path=str(OUT / name), full_page=True)

if __name__ == "__main__":
    from playwright.sync_api import expect
    errors = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH"), headless=True, args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
        fixture = Fixtures(); page.route("**/api/**", fixture.handle)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE, wait_until="networkidle")
        expect(page.get_by_role("button", name="101 Example Street", exact=True)).to_be_visible()
        screenshot(page, "overview-desktop.png")
        page.get_by_role("button", name="101 Example Street", exact=True).click()
        expect(page.get_by_role("dialog", name="101 Example Street")).to_be_visible()
        expect(page.get_by_text("2 screening constraints to review")).to_be_visible()
        screenshot(page, "dossier-overview.png")
        page.get_by_role("tab", name="Underwriting", exact=True).click()
        expect(page.get_by_text("Attorney review required.", exact=False)).to_be_visible()
        screenshot(page, "dossier-underwriting.png")
        page.keyboard.press("Escape")
        expect(page.get_by_role("dialog", name="101 Example Street")).not_to_be_visible()
        page.get_by_role("link", name="Explore properties", exact=False).click()
        page.wait_for_load_state("networkidle")
        expect(page.get_by_text("The property list works without a map token.")).to_be_visible()
        screenshot(page, "properties-desktop.png")
        page.get_by_role("searchbox", name="Search properties by address or parcel ID").fill("DEMO-002")
        expect(page.get_by_role("button", name="103 Example Lane", exact=True)).to_be_visible()
        expect(page.get_by_role("button", name="101 Example Street", exact=True)).not_to_be_visible()
        page.get_by_role("button", name="Clear all filters").click()
        page.get_by_role("button", name="Next results", exact=True).click()
        expect(page.get_by_text("31-36 of 36")).to_be_visible()
        page.get_by_role("button", name="Strong fit", exact=True).click()
        expect(page.get_by_text("1-10 of 10")).to_be_visible()
        page.get_by_role("button", name="AI filter", exact=True).click()
        page.get_by_role("textbox", name="Describe an AI property filter").fill("under 400k")
        page.get_by_role("button", name="Apply filter", exact=True).click()
        expect(page.get_by_text("The AI filter could not complete.", exact=False)).to_be_visible()
        expect(page.get_by_role("button", name="Apply filter", exact=True)).to_be_enabled()
        page.keyboard.press("Control+k")
        expect(page.get_by_role("dialog", name="Go to a page")).to_be_visible()
        page.get_by_role("combobox", name="Search pages").fill("investment thesis")
        screenshot(page, "page-search.png")
        page.keyboard.press("Escape")
        page.goto(BASE + "/map?apn=DEMO-002", wait_until="networkidle")
        expect(page.get_by_role("dialog", name="103 Example Lane")).to_be_visible()
        page.get_by_role("button", name="Close property dossier").click()
        expect(page.get_by_role("dialog", name="103 Example Lane")).not_to_be_visible()
        page.goto(BASE + "/brief", wait_until="networkidle")
        expect(page.get_by_text("Review your latest property shortlist", exact=True)).to_be_visible()
        screenshot(page, "brief-desktop.png")
        page.goto(BASE + "/settings", wait_until="networkidle")
        expect(page.get_by_role("heading", name="First-run setup", exact=True)).to_be_visible()
        screenshot(page, "settings-desktop.png")
        page.get_by_label("Runner passcode", exact=True).fill("synthetic-passcode")
        page.get_by_role("button", name="Unlock controls").click()
        expect(page.get_by_role("button", name="Re-score properties", exact=False)).to_be_visible()
        assert page.evaluate("sessionStorage.getItem('lot_run_pc')") is None
        page.get_by_role("button", name="Re-score properties", exact=False).click()
        expect(page.get_by_text("Synthetic command outcome.", exact=False)).to_be_visible()
        page.get_by_role("button", name="Lock controls", exact=True).click()
        expect(page.get_by_role("button", name="Unlock controls")).to_be_visible()
        if os.environ.get("LOT_UI_HARNESS") == "true":
            page.goto(BASE + "/__ui-qa/pipeline", wait_until="networkidle")
            expect(page.get_by_role("heading", name="Keep the next decision in sight.")).to_be_visible()
            screenshot(page, "pipeline-desktop.png")
            page.get_by_role("checkbox", name="Include exited & passed").check()
            expect(page.get_by_role("heading", name="Passed", exact=True)).to_be_visible()
            page.get_by_role("searchbox", name="Search pipeline").fill("DEMO-001")
            expect(page.get_by_role("link", name="101 Example Street", exact=True)).to_be_visible()
            page.get_by_role("button", name="analyzing", exact=True).click()
            expect(page.get_by_text("Why advance to analyzing?", exact=False)).to_be_visible()
            assert not any(p == "/api/actions" and body and "transition-deal" in body for p,m,body in fixture.calls)
            page.get_by_role("button", name="great cash flow", exact=False).click()
            page.wait_for_timeout(700)
            assert any(p == "/api/actions" and body and '"reason":"great_cash_flow"' in body for p,m,body in fixture.calls)
            page.goto(BASE + "/__ui-qa/leads", wait_until="networkidle")
            expect(page.get_by_role("heading", name="Start a better conversation.")).to_be_visible()
            screenshot(page, "leads-desktop.png")
        fixture.empty = True
        page.goto(BASE, wait_until="networkidle")
        expect(page.get_by_text("Make this workspace yours.", exact=True)).to_be_visible()
        screenshot(page, "overview-empty.png")
        fixture.failure = True
        page.goto(BASE + "/map", wait_until="networkidle")
        expect(page.get_by_text("Properties could not be loaded", exact=True)).to_be_visible()
        screenshot(page, "properties-error.png")
        fixture.failure = False; fixture.empty = False
        page.get_by_role("button", name="Try again").click()
        expect(page.get_by_role("button", name="101 Example Street", exact=True)).to_be_visible()
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(BASE, wait_until="networkidle")
        screenshot(page, "overview-mobile.png")
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Overview overflows mobile viewport"
        page.get_by_role("button", name="Open navigation").click()
        expect(page.get_by_role("dialog", name="Navigation", exact=True)).to_be_visible()
        screenshot(page, "navigation-mobile.png")
        page.get_by_role("navigation", name="Mobile navigation").get_by_role("link", name="Properties", exact=True).click()
        expect(page.get_by_role("dialog", name="Navigation", exact=True)).not_to_be_visible()
        page.wait_for_load_state("networkidle")
        screenshot(page, "properties-mobile.png")
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Property page overflows mobile viewport"
        assert not errors, "Browser errors: " + repr(errors)
        (OUT / "result.json").write_text(json.dumps({"passed": True, "fixture_records": len(FEATURES), "page_errors": errors, "api_calls": len(fixture.calls)}, indent=2))
        print("PASS: overview, dossier, tabs, Escape, property search, pagination, filters, AI failure recovery, command menu, deep links, empty/error/retry, mobile navigation and overflow.")
        browser.close()
