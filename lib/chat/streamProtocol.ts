/**
 * Chat streaming wire protocol (spec 024 streaming follow-up). The engine streams an agent's visible
 * answer as raw UTF-8 text deltas, then emits ONE trailing frame carrying the structured tail the UI
 * needs (the tool trace + the action proposals to confirm). The frame is delimited by an ASCII record
 * separator (U+241E ␞ / 0x1E) — a control char that never appears in model prose — so the client can
 * stream text live and split off the metadata only once it arrives. A sentinel-free buffer is pure
 * text (the explainer stream), so one client path handles both. Pure + unit-tested.
 */
import type { Proposal } from "../agent/tools.js";

export const SENTINEL = "\x1e";

export interface ChatStreamMeta {
  trace: Array<{ tool: string; args: unknown }>;
  proposals: Proposal[];
}

/** Encode the trailing metadata frame (call once, after all text has streamed). */
export function encodeFinal(meta: ChatStreamMeta): string {
  return SENTINEL + JSON.stringify(meta);
}

/**
 * Strip any literal sentinel char from a streamed text delta. The sentinel must appear exactly once
 * in the whole stream (the boundary before the metadata frame); a model that ever emitted a raw
 * 0x1E in prose would otherwise split the client early and drop the proposals. Vanishingly rare, but
 * we guard it rather than trust it — the char carries no visible meaning, so removing it is lossless.
 */
export function stripSentinel(textDelta: string): string {
  return textDelta.includes(SENTINEL) ? textDelta.split(SENTINEL).join("") : textDelta;
}

/**
 * Split an accumulated stream buffer into the visible text and (if the sentinel has arrived) the
 * decoded metadata. While still streaming (no sentinel yet) meta is null and text is what's arrived.
 * A malformed metadata frame degrades to null meta rather than throwing — the text still renders.
 */
export function parseChatStream(buf: string): { text: string; meta: ChatStreamMeta | null } {
  const i = buf.indexOf(SENTINEL);
  if (i < 0) return { text: buf, meta: null };
  const text = buf.slice(0, i);
  const tail = buf.slice(i + SENTINEL.length);
  try {
    return { text, meta: JSON.parse(tail) as ChatStreamMeta };
  } catch {
    return { text, meta: null };
  }
}
