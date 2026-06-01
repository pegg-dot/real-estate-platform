# Domain knowledge

The scoring (003) and financing (004) engines must reflect the real-estate domain
knowledge, not generic heuristics. The source of truth lives in the project knowledge
base and should be copied/symlinked here when building:

- `Knowledge Base/Concepts/playbook.md` — the core frameworks + Nate's thesis
- `Knowledge Base/Concepts/creative-finance.md` — sub2, seller finance, the equity math,
  legal guardrails (the basis for spec 004)
- `Knowledge Base/Concepts/lead-generation.md` — sourcing channels + compliance
- `Knowledge Base/Concepts/glossary.md` — term definitions
- `Knowledge Base/RESEARCH-FINDINGS.md` — the cited evidence (data access, zoning by
  market, financing legality, proptech landscape)
- `Knowledge Base/STRATEGY-REFRAMES.md` — why this is a buying machine first

When the repo is standalone, copy these in (or generate them) so the agents have the
domain rules in-repo. The knowledge layer (`knowledge_rule`/`knowledge_note` tables) is
populated from these files.
