# Spec 001 — Thesis Compiler

**Status:** ready to build · **Depends on:** nothing · **Unlocks:** 003 (scoring), 004 (financing)

## Purpose
The onboarding that *asks Nate the questions* and produces a structured **Investor Thesis**
(`config/thesis.json`, schema in `thesis.example.json`). Everything downstream — scoring,
filtering, financing recommendations — reasons against this profile. This is what makes
the tool "for Nate" rather than generic.

## User story
> As Nate, I answer a short, smart questionnaire (or talk to it in natural language) and
> the tool builds a profile of what I want, so every property it shows me is judged by
> *my* goals — not a one-size-fits-all score.

## Behavior
1. **Two intake modes:**
   - **Guided** — a small set of high-signal questions (capital posture, return targets,
     cash-flow vs appreciation, management appetite, markets, by-room vs whole-house, risk
     red lines, financing openness). 8–10 questions max; never a wall.
   - **Conversational** — Nate describes his goals in prose; an LLM extracts the same
     structured fields and confirms them back ("Here's what I heard — fix anything?").
2. **Smart defaults.** Pre-fill from what's known (all-cash, buy-and-hold, Charlottesville
   + Miami, college-town). Nate edits rather than starts blank.
3. **Output** a validated `thesis.json` (versioned; keep history). Re-runnable any time.
4. **Explain the consequence** of each answer ("Weighting cash-flow over appreciation will
   favor by-room deals near campus").

## Inputs / Data
- The schema and seed in `config/thesis.example.json`.
- No external data needed.

## Acceptance criteria (tests)
- Produces a `thesis.json` that validates against the schema.
- Guided and conversational modes yield equivalent structured output for the same intent.
- Re-running preserves prior versions (no silent overwrite).
- Weights sum to 1.0 (normalize if not); hard constraints are booleans/enums.
- Missing answers fall back to documented defaults, flagged as "default, not confirmed."

## Edge cases
- Contradictory answers (e.g. "all cash" + "max leverage") → surface the conflict, ask.
- Nate skips everything → fully-defaulted thesis, clearly marked as unconfirmed.

## Future hooks
- The thesis becomes self-tuning: the LEARN loop nudges weights based on which deals Nate
  actually pursues vs passes (see architecture → outcome-trained judgment).
