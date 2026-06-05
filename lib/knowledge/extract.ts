/**
 * LLM transcript extractor (spec 016) — the credit-gated half of the distillation pipeline. Turns
 * a raw transcript/book into the SAME structured Artifact[] the offline JSON path produces, so the
 * rest of the pipeline (diff → conflict-aware store → cited retrieval) is identical either way.
 * Gated on ANTHROPIC_API_KEY; degrades with a clear, catchable error (no fabrication, no stub).
 * Built but not run — lights up when billing is added.
 */
import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import type { Artifact, Extractor } from "./distill.js";

const EXTRACTED = z.object({
  artifacts: z.array(z.object({
    kind: z.enum(["rule", "exemplar", "param", "concept"]),
    key: z.string().describe("stable slug: rules 'topic#name', exemplars 'objection#name' or 'situation#name', params snake_case like cost_to_sell_pct"),
    value: z.string().describe("rules: the recommendation; exemplars: the verbatim response/framing; params: the numeric value as a string; concepts: the definition"),
    condition: z.string().optional().describe("rules only: the human-readable 'when this applies'"),
    confidence: z.enum(["real", "modeled", "estimated", "low", "unknown"]).describe("how strongly the source asserts it"),
  })),
});

const SYSTEM = `You distill a real-estate investing transcript/book into structured, CITED knowledge.
Extract ONLY what the source actually says — never invent. Be FAITHFUL and THOROUGH: capture the
reasoning, not just conclusions. Produce:
- concepts: the source's FRAMEWORKS, mental models, definitions, and reasoning chains, each as a
  self-contained explanation (key = a short slug like 'today-tomorrow-forever-money'; value = a full
  multi-sentence explanation in the source's own logic). ALSO capture the source's explicit
  "open questions / things to verify / what's new vs last time" as concepts. Favor MANY rich
  concepts over few — this is where the playbook's depth lives.
- rules: condition -> recommendation (creative-finance/structure/strategy heuristics), confidence-tagged.
- exemplars: how the expert COMMUNICATES — objection->response (key 'objection#...') and
  situation->framing (key 'situation#...'); value = the verbatim framing.
- params: named numeric calibrations (cost_to_sell_pct, mtr_multiplier, stale_on_market_days, etc.)
  as snake_case keys with the value as a string.
Capture EVERY distinct play/strategy the source names (wholesale, novation, subject-to, seller-finance,
hybrid/"Morby" debt plays, gap/transactional funding, BRRRR, lease options, etc.) — as a concept
(what/when/why) and, where it gives a heuristic, a rule. Tag confidence by how firmly the source
asserts each item. Legal/financial claims stay as the source's OPINION — never settled fact.`;

export const llmExtractor: Extractor = async (text, meta) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set — cannot distill a raw transcript (use a .json artifacts file, or add credits).");
  }
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),     // extraction quality matters; structured output
    schema: EXTRACTED,
    system: SYSTEM,
    prompt: `Source: ${meta.source}\nSpeaker: ${meta.speaker ?? "unknown"}\n\nTranscript:\n${text.slice(0, 120_000)}`,
  });
  return object.artifacts.map((a): Artifact => ({
    ...a, source: meta.source, speaker: meta.speaker ?? null, asOf: null,
  }));
};
