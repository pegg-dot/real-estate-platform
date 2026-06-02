import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Translate a plain-English query into structured map filters via Claude. Degrades cleanly to a
// "add Anthropic credits" message when the account can't run (the whole UI flow still works).
const FilterSchema = z.object({
  maxPrice: z.number().nullable().describe("max assessed value in dollars"),
  minBeds: z.number().nullable(),
  byRoomLegalOnly: z.boolean().nullable().describe("only parcels where by-the-room renting is legal"),
  minScore: z.number().nullable().describe("min thesis score 0-100"),
  absenteeOnly: z.boolean().nullable(),
  distressOnly: z.boolean().nullable().describe("only parcels with a visible-neglect / distress signal"),
  maxDistanceMiles: z.number().nullable().describe("max miles from UVA campus"),
});

export async function POST(req: Request) {
  const { prompt } = (await req.json()) as { prompt?: string };
  if (!prompt) return Response.json({ ok: false, error: "prompt required" }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ ok: false, error: "ANTHROPIC_API_KEY not set — add it to .env." });
  }
  try {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5-20251001"),
      schema: FilterSchema,
      prompt: `Translate this Charlottesville rental-search query into map filters. Set any field NOT ` +
        `mentioned to null. Query: "${prompt}"`,
    });
    return Response.json({ ok: true, filter: object });
  } catch (e) {
    const err = e as { message?: string };
    return Response.json({ ok: false, error: `Couldn't run the LLM (${String(err.message || e).slice(0, 200)}). ` +
      `If it's a credit error, add Anthropic billing.` });
  }
}
