# claude-config/ → rename to `.claude/` in your real repo

These are the Claude Code skills and subagents for LOT. In this build session the literal
`.claude/` path is protected, so they live here. **When you set up the GitHub repo, move
this folder to `.claude/`** (and `mcp.example.json` → `.mcp.json`).

```
.claude/
├── agents/        # subagents (code-reviewer, underwriter, zoning-analyst, ...)
├── skills/        # reusable how-tos (run-market-refresh, add-supabase-migration, ...)
├── commands/      # slash commands (add as needed)
└── hooks/         # lint/test-on-edit scripts (add as needed)
```
