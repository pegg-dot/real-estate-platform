# Engineering & Build Plan (how we'd actually build it with AI)

How to build this with Claude Code as the primary engine, the way AI-native teams ship
in 2025-2026. Cited research in `RESEARCH-FINDINGS.md` is the source; this is the
applied plan. Read the strategy caveat first → `STRATEGY-REFRAMES.md` (it argues we
should build a *thin* internal tool before a platform — this plan supports either, but
start thin).

---

## The build philosophy: spec-driven, not vibe-coded

The dividing line in 2025-2026 is **"vibe coding" (prompt → accept → patch bugs forever)**
vs **spec-driven development (write the spec in markdown → AI implements against it)**.
Vibe coding hits a wall around day 60-90 (technical debt, 20-30% of capacity lost to
bugs, ~half of AI-generated code carrying vulnerabilities). Spec-driven + tests + small
commits is the fix. For a non-developer, this discipline is non-negotiable — it's the
difference between a shippable product and a day-90 rewrite.

**The core loop (Anthropic-documented):** Explore → Plan → Implement → Commit.
- Use Claude Code **plan mode** (Shift+Tab) so it writes a blueprint before coding.
- Keep a `/specs` folder: one markdown spec per feature (what, why, acceptance tests).
- **Tests are the agent's external oracle** — without them its only check is its own
  judgment, which degrades as context fills. Write the test, then let it implement.
- Commit per step so any break is cheap to revert.
- A **code-reviewer subagent** + **lint/test hooks** catch the security/correctness
  issues AI code is prone to.

---

## Repo structure (built for agent-driven work)

```
real-estate-platform/
├── CLAUDE.md            # <200 lines: stack, conventions, domain rules, links to skills
│                        #   (if it's bloated, Claude ignores half of it — keep it tight)
├── /docs                # architecture, data model, the real-estate DOMAIN knowledge
│   ├── data-model.md
│   ├── domain/          # ← symlink/copy the Concepts/ files: playbook, creative-finance...
│   └── decisions/       # ADRs (architecture decision records)
├── /specs               # one markdown spec per feature: spec → design → tasks
│   ├── 001-thesis-compiler.md
│   ├── 002-charlottesville-ingest.md
│   ├── 003-scoring-engine.md
│   └── 004-financing-recommender.md
├── .claude/
│   ├── skills/          # reusable how-tos (e.g. add-supabase-migration, run-market-refresh)
│   ├── agents/          # subagents: scout, zoning, underwriter, risk, code-reviewer
│   ├── commands/        # slash commands
│   └── hooks/           # lint/test-on-edit scripts
├── .mcp.json            # MCP servers: Supabase, Postgres, filesystem, web fetch
└── /src                 # Next.js app
```

> The KB you already have *is* the `/docs/domain` layer. The build literally starts from
> these markdown files — that's why the knowledge base was step one.

### CLAUDE.md, skills, subagents, hooks, MCP — what they are
- **CLAUDE.md** — auto-loaded project rules. The single most important file. Short.
- **Skills** (`.claude/skills/<name>/SKILL.md`) — reusable "how to do X here," auto- or
  `/`-invoked. This is your "skill graph": CLAUDE.md → skills → subagents → packaged as a
  plugin. (The same skill mechanism this very project uses.)
- **Subagents** — separate Claude instances with their own context + tools; they do a job
  and return a summary, protecting the main context. (Exactly how the market-research
  agents in this project ran.) e.g. a read-only `code-reviewer`, a `db-migrator`.
- **Hooks** — shell scripts that run deterministically (lint/test after every edit).
- **MCP (Model Context Protocol)** — open standard to connect the app/agents to external
  data/tools (Supabase, Postgres, the county APIs). Tools / Resources / Prompts.

---

## Recommended stack (proven, AI-agent-friendly)

| Layer | Pick | Notes |
|---|---|---|
| Build harness | **Claude Code** + plan mode + `/specs` | Don't need Kiro/Spec Kit's full IDE — plan mode gets ~80% of SDD value |
| Front-end | **Next.js + React + shadcn/ui** on **Vercel** | The dominant 2025-26 stack; AI agents know it cold |
| UI prototyping | **v0** + **Claude Artifacts** | Generate components, paste into repo; ("Claude design" = this) |
| Backend/DB/Auth | **Supabase** (Postgres + Auth + Edge Functions) | One backend; includes pgvector + cron |
| Maps | **Mapbox GL** via react-map-gl (+ **deck.gl** later) | Standard for real-estate maps; cluster + bounds-load for big datasets |
| Scheduled refresh | **Supabase Cron** → **Inngest** when multi-step | The weekly/monthly data loop you want |
| LLM orchestration | **Vercel AI SDK** (LangGraph only if truly needed) | Native to the stack; avoid premature complexity |
| Knowledge/judgment | full-context + prompt caching → **pgvector + reranker** → GraphRAG only if proven need | Cheapest-first; under ~200k tokens you may not need a vector DB at all |
| Agent memory | **Mem0** | Low lock-in; "remember the user/deal" |

**Cost/time reality:** a non-dev MVP via this path is roughly **~$1,000 and weeks, not
months** (subscriptions + API credits + hosting). Documented full SaaS builds: ~8 weeks,
95%+ AI-coded, driven by a strong CLAUDE.md. Y Combinator: 25% of a recent batch had
codebases ≥95% AI-generated.

**Where it breaks (plan for it):**
- **The "last 20%"** (edge cases, polish, integrations) can take as long as the first 80%.
- **Technical debt timeline:** warning signs ~day 30, velocity drop ~day 60, reckoning
  day 60-90 — *unless* you hold the spec/test/commit/review discipline.
- **Security:** ~half of AI-generated code has vulns → a code-reviewer subagent + the
  discipline above is mandatory for anything touching financial/user data.

---

## GitHub & how we'd actually proceed
1. **Create the repo** (`real-estate-platform`) and scaffold the structure above. I can
   generate the full skeleton — CLAUDE.md, `/specs`, `/docs` (seeded from the KB),
   `.claude/` skills+subagents, `.mcp.json` — as files you push to GitHub.
2. **Write specs before code** — start with `001-thesis-compiler` and
   `002-charlottesville-ingest`.
3. **Build in Claude Code** against those specs, plan-mode first, tests as the oracle.
4. **Wire the free county APIs** (Charlottesville + Miami-Dade ArcGIS) for the data loop.
5. Layer features per the v1→v10 ladder in `PRODUCT-SPEC-v1-to-v10.md`.

> Note: I can scaffold the repo and write all the markdown (specs, CLAUDE.md, skills) from
> here. Pushing to GitHub and running Claude Code on your machine is the part you'd do
> (or we set up together). The whole point: the planning artifacts I produce here *are*
> the inputs an AI coding agent needs.

---

## Honest hype-vs-proven
- **Proven:** Next.js+Supabase+Vercel; Claude Code Explore→Plan→Implement→Commit + TDD +
  tight CLAUDE.md; pgvector at small/mid scale; Mapbox; the ~$1k/weeks economics.
- **Real but newer (don't over-invest yet):** Kiro, Spec Kit, GraphRAG, LangGraph.
- **Overhyped:** "AI builds the whole thing" (the last 20% / global correctness bites);
  "RAG is dead"; "just vibe it."
