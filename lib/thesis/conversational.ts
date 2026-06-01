/**
 * Conversational thesis intake (spec 001) — describe your goals in plain English, an LLM
 * extracts the structured answers, and we build + confirm the thesis. The LLM call is
 * injectable (Extractor) so it's testable offline; the real one uses the Vercel AI SDK +
 * Claude and needs ANTHROPIC_API_KEY.
 */
import { z } from "zod";

import { compileGuided, type GuidedAnswers } from "./compile.js";
import { type Thesis } from "./schema.js";

export const GuidedAnswersSchema = z.object({
  capitalPosture: z.string().describe("all_cash_default | leverage_default | mixed"),
  horizon: z.string().describe("long_term_hold | medium_term | short_term_flip"),
  priority: z.enum(["cashflow", "appreciation", "balanced"]),
  minCashOnCash: z.number().describe("decimal fraction, e.g. 0.08 for 8%"),
  byRoomFocus: z.boolean().describe("true if renting by-the-room / student housing"),
  markets: z.array(z.object({ name: z.string(), state: z.string().length(2) })).min(1),
  leverageAppetite: z.string().optional(),
});

export type Extractor = (prose: string) => Promise<GuidedAnswers>;

export async function compileConversational(prose: string, extract: Extractor):
  Promise<{ thesis: Thesis; conflicts: string[]; extracted: GuidedAnswers }> {
  const extracted = await extract(prose);
  const { thesis, conflicts } = compileGuided(extracted);
  return { thesis, conflicts, extracted };
}

/** The real LLM extractor (Vercel AI SDK + Claude). Requires ANTHROPIC_API_KEY. */
export function claudeExtractor(model = "claude-haiku-4-5-20251001"): Extractor {
  return async (prose) => {
    const { generateObject } = await import("ai");
    const { anthropic } = await import("@ai-sdk/anthropic");
    const { object } = await generateObject({
      model: anthropic(model),
      schema: GuidedAnswersSchema,
      prompt:
        "You are onboarding a buy-and-hold real estate investor. Extract their thesis from " +
        "the description below into the structured fields. If something isn't stated, infer a " +
        "sensible default for a cash buyer (all_cash_default, long_term_hold, balanced).\n\n" +
        `Description:\n${prose}`,
    });
    return object as GuidedAnswers;
  };
}
