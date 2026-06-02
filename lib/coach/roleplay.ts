/**
 * Roleplay mode (spec 015 Part B) — "Pace's daily dial as software". The AI plays the seller's
 * inferred persona so Nate can practice the call, then scores the rep on a rubric. The seller
 * turns + the rubric scoring are LLM tasks (gated on Anthropic credits); this module owns the PURE,
 * testable parts: building the persona system-prompt from the lead's inferred motivation/bunny, and
 * the rubric contract. runRoleplayTurn is the credit-gated seam.
 */
export interface PersonaInput {
  ownerName?: string | null;
  motivationType: string;
  likelyBunny: string;
  approach: string;                 // the situation read's approach/angle
  tone?: "gentle" | "standard" | "urgent";
}

/** The rep is scored 0..1 on each dimension; overall is their mean. */
export interface RubricScore {
  rapport: number;
  discovery: number;
  bunnyFound: number;       // did the rep surface the real reason?
  structureFit: number;     // did they frame the structure that fits?
  overall: number;
  notes: string[];
}

/**
 * Build the system prompt that makes the LLM play this seller. Pure + deterministic. The seller is
 * realistic and guarded — they do NOT volunteer the bunny; the rep has to earn it through rapport
 * and discovery (that's the whole point of the drill).
 */
export function buildPersonaPrompt(i: PersonaInput): string {
  const name = i.ownerName ? ` Your name is ${i.ownerName}.` : "";
  const tone = i.tone ?? "standard";
  const motivation = i.motivationType.replace(/_/g, " ");
  const bunny = i.likelyBunny.replace(/_/g, " ");
  return [
    `You are role-playing a property owner a real-estate investor has cold-contacted.${name}`,
    `Your underlying situation: a ${motivation}. Your real, emotional reason for maybe selling`,
    `(the "bunny") is ${bunny} — but a guarded person does NOT volunteer that to a stranger.`,
    `Reveal it ONLY if the rep earns your trust with genuine rapport and good discovery questions;`,
    `if they lead with a lowball or a pitch, get guarded or end the call.`,
    `Stay in character at all times — do not break character or explain that you are an AI.`,
    `Speak naturally and briefly, like a real person on the phone. Your demeanor is ${tone}.`,
    `Context the rep is working from (do not quote it back): "${i.approach}"`,
  ].join(" ");
}

/** The LLM-backed turn (seller reply + optional rubric). Gated: throws a clear, catchable error
 * when no model is configured, so callers degrade gracefully (no fabrication, no silent stub). */
export type RoleplayRunner = (history: Array<{ role: "rep" | "seller"; text: string }>, persona: PersonaInput)
  => Promise<{ sellerReply: string; rubric?: RubricScore }>;

export const LLM_REQUIRED =
  "Roleplay needs a language model (ANTHROPIC_API_KEY + credits). The persona prompt is ready; " +
  "wire a RoleplayRunner once billing is enabled.";
