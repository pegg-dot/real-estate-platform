# Claude Code Kickoff — exactly what to do and say

This repo is ready to build. Below is the setup, the **exact prompts** to paste into
Claude Code, and the order to build in.

---

## Step 0 — One-time setup (do this first)
1. **Get the repo onto your machine + GitHub.**
   - Copy the `real-estate-platform/` folder out of the Claude project to wherever you
     keep code.
   - Rename two things (they were renamed in this session to avoid conflicts):
     - `claude-config/`  →  `.claude/`
     - `mcp.example.json`  →  `.mcp.json`
   - Then:
     ```bash
     cd real-estate-platform
     git init && git add -A && git commit -m "Scaffold: LOT real estate platform"
     gh repo create real-estate-platform --private --source=. --push   # or create on github.com and push
     ```
2. **Install Claude Code** (if you haven't) and accounts you'll need soon: GitHub, Vercel,
   Supabase, Mapbox. (Free tiers are fine to start.)
3. **Open the repo in Claude Code:** `cd real-estate-platform && claude`

---

## Step 1 — The first message to paste into Claude Code

> Copy-paste this verbatim. It orients Claude Code and starts spec-driven, not vibe-coded.

```
Read CLAUDE.md, docs/architecture.md, docs/data-model.md, and all of /specs. This is an
AI-native real estate tool for me (Nate) to find, score, and finance buy-and-hold student
rentals in Charlottesville. We build spec-driven: plan before code, write tests first,
commit per step. Use the code-reviewer subagent on every change.

Do NOT start coding yet. First, enter plan mode and give me:
1. A short confirmation of what you understand the project to be (3-4 sentences).
2. The concrete build plan for spec 001 (Thesis Compiler) and spec 002 (Charlottesville
   ingest) — the files you'll create, the tests you'll write, and the order.
3. The stack decisions you're locking in (confirm Next.js + Supabase + Vercel + Mapbox)
   and anything you'd push back on.

Then stop and wait for my approval before writing code.
```

## Step 2 — After it shows the plan
- Read it. If good, say: **"Approved — build spec 002 (Charlottesville ingest) first; the
  ingestion/charlottesville.py script already works, wire it into Supabase per the spec.
  Write the tests first."** (Build ingest before the UI — data first.)
- Then: **"Now build spec 001 (Thesis Compiler)."**
- Then 003 (scoring) → 004 (financing engine — read docs/financing-engine-design.md
  closely) → 005 (map UI) → 006 (agent swarm).

## Step 3 — Standing instructions (paste when relevant)
- When it finishes any feature: **"Run the code-reviewer subagent on this change and show
  me the verdict before committing."**
- If it starts coding without a spec: **"Stop — write/update the spec in /specs first,
  then plan, then code."**
- For DB changes: **"Create a Supabase migration for this; don't edit the schema ad hoc."**
- When you want depth on the moat: **"Implement the financing engine exactly per
  docs/financing-engine-design.md, including the legal-guardrail block and the cap-gains
  modeler. Unit-test the math hard."**

---

## Golden rules to hold Claude Code to (from the research)
- **Spec → plan → test → implement → commit.** Never skip to code.
- **Keep CLAUDE.md short.** If it bloats, prune it.
- **Buy commodity, build the edge.** Don't let it rebuild data/comps — wire APIs. The code
  we own is the scoring + the financing engine.
- **Legal guardrails are a feature.** Every creative-finance output carries its guardrail
  + attorney trigger, or the build fails review.
- **Security matters** (real money/data): the code-reviewer subagent is mandatory.

## Reference while building
- `examples/charlottesville-dossier-v0.md` — a real, hand-run output of the loop (what
  the tool should produce). Use it as the target.
- `docs/financing-engine-design.md` — implementation-grade spec for the moat.
- The knowledge base (`../Knowledge Base/`) — the domain truth the engines must reflect.

---

## Realistic expectations (so you're not surprised)
- A working data-ingest + thesis + scoring slice is a **weeks-not-months, ~$1k** effort
  this way. The map UI + financing engine are the meatier pieces.
- The "last 20%" (edge cases, polish) is where it slows down — the spec/test/review
  discipline is what keeps it from becoming a day-90 rewrite.
- Build the ingest + scoring + a basic map first; get a real ranked list on a real map;
  *then* go deep on the financing engine and the agent swarm.
