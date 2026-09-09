"""Create test-only render routes for server-fed components; never ship these routes.
The CI job deletes ui-qa immediately after testing and asserts a clean worktree.
"""
from pathlib import Path
import json
import os
import runpy
if os.environ.get("LOT_UI_HARNESS") != "true":
    raise SystemExit("Fixture routes require explicit LOT_UI_HARNESS=true in an isolated test checkout.")
module = runpy.run_path(str(Path(__file__).with_name("workspace.spec.py")), run_name="fixtures")
properties = [feature["properties"] for feature in module["FEATURES"]]
stages = ["watch", "analyzing", "analyzing", "offer", "under_contract", "owned", "passed", "exited"]
deals = [{"id": f"test-{i}", "apn": p["apn"], "address": p["address"], "stage": stages[i], "score": p["score"], "updated_at": "2026-09-09T00:00:00Z", "recommended_structure": p["structure"]} for i,p in enumerate(properties[:8])]
leads = [{"id": f"test-{i}", "motivation_score": 75-i, "stack_score": 89-i*3, "motivation_type": "long_tenure_absentee", "likely_bunny": "cash_flow", "recommended_structure": p["structure"], "bunny_confidence": "0.72", "approach": "Direct mail", "method": "letter", "segment": "absentee", "status": "new", "owner_name": f"Example Owner {i+1}", "address": p["address"], "distress": p["distress"]} for i,p in enumerate(properties[:6])]
for name, component, source, props in [
    ("pipeline", "PipelineBoard", "deals/PipelineBoard", f"deals={{{json.dumps(deals)}}}"),
    ("leads", "LeadsTable", "leads/LeadsTable", f"leads={{{json.dumps(leads)}}} counts={{{{leads: 6, mailed: 2, closes: 0}}}}"),
]:
    target=Path("web/app/ui-qa")/name/"page.tsx"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(f'import {component} from "../../{source}";\nexport default function FixturePage() {{ return <{component} {props} />; }}\n')
