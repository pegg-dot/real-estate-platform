/**
 * LLM-backed roleplay runner (spec 015 Part B) — the credit-gated half. The model plays the
 * seller's inferred persona (system prompt from buildPersonaPrompt) and, once there's enough
 * conversation, scores the REP on the rubric. Gated on ANTHROPIC_API_KEY; degrades with a clear
 * error (no fabricated turns). Built but not run — lights up when billing is added.
 */
import { generateText, generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { buildPersonaPrompt, LLM_REQUIRED, type RoleplayRunner, type RubricScore } from "./roleplay.js";

const RUBRIC = z.object({
  rapport: z.number().min(0).max(1),
  discovery: z.number().min(0).max(1),
  bunnyFound: z.number().min(0).max(1),
  structureFit: z.number().min(0).max(1),
  notes: z.array(z.string()),
});

export const llmRoleplayRunner: RoleplayRunner = async (history, persona) => {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error(LLM_REQUIRED);
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // the seller's next line, in character
  const { text: sellerReply } = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: buildPersonaPrompt(persona),
    messages: history.map((h) => ({ role: h.role === "rep" ? ("user" as const) : ("assistant" as const), content: h.text })),
    maxOutputTokens: 300,
  });

  // score the rep once the call has some substance
  let rubric: RubricScore | undefined;
  if (history.filter((h) => h.role === "rep").length >= 2) {
    const transcript = history.map((h) => `${h.role.toUpperCase()}: ${h.text}`).join("\n");
    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5-20251001"),
      schema: RUBRIC,
      system: `Score the REP (not the seller) 0..1 on: rapport (did they build trust?), discovery ` +
        `(did they ask good questions?), bunnyFound (did they surface the seller's real reason?), ` +
        `structureFit (did they frame a structure that fits the seller's situation?). Be honest; ` +
        `give 1-3 short coaching notes.`,
      prompt: `Seller persona: ${persona.motivationType} / ${persona.likelyBunny}.\n\nTranscript:\n${transcript}`,
    });
    rubric = {
      ...object,
      overall: Number(((object.rapport + object.discovery + object.bunnyFound + object.structureFit) / 4).toFixed(3)),
    };
  }

  return { sellerReply, rubric };
};
