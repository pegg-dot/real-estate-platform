/**
 * Chat dispatch (spec 024) — routes an engine-side chat agent to the capability it wraps and returns
 * a uniform { text, trace, proposals }. The Explainer is NOT here — it answers in-process in the web
 * route (fast Haiku). This module is the engine half (Operator / Interrogator / Coach), reachable via
 * scripts/chat.ts. Pure helpers (extractApn/extractLeadId/isEngineAgent) are unit-tested; the engine
 * calls are integration-verified.
 */
import type { Sql } from "../db/client.js";
import { runAgent } from "../agent/run.js";
import { interrogateForApn } from "../interrogate/forDeal.js";
import { buildPlaybookForLead } from "../coach/forLead.js";
import type { Proposal } from "../agent/tools.js";
import type { DualPersonaReview } from "../interrogate/personas.js";
import type { Playbook } from "../coach/playbook.js";
import { resolveContext, buildContextBlock, appendToLastUser } from "./buildContext.js";

export type ChatAgentId = "explainer" | "operator" | "interrogator" | "coach";
const ENGINE = new Set<ChatAgentId>(["operator", "interrogator", "coach"]);
export const isEngineAgent = (id: string): boolean => ENGINE.has(id as ChatAgentId);

export interface ChatMsg { role: "user" | "assistant"; content: string }
export interface ContextRef { type: "parcel" | "lead"; id: string }
export interface ChatResult {
  text: string;
  trace: Array<{ tool: string; args: unknown }>;
  proposals: Proposal[];
}

// a Charlottesville APN looks like 230014000; a lead id is a UUID. Used to let the dedicated
// Interrogator/Coach agents work from an inline mention before the context-feed (Phase 3) exists.
export const APN_RE = /\b\d{9,12}\b/;
export const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
export const extractApn = (text: string): string | null => text.match(APN_RE)?.[0] ?? null;
export const extractLeadId = (text: string): string | null => text.match(UUID_RE)?.[0] ?? null;

const lastUser = (messages: ChatMsg[]): string =>
  [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
const EMPTY = { trace: [] as ChatResult["trace"], proposals: [] as Proposal[] };

export async function dispatchChat(
  sql: Sql, agent: ChatAgentId, messages: ChatMsg[], context: ContextRef[] = [],
): Promise<ChatResult> {
  if (agent === "explainer") throw new Error("the explainer runs in-process, not on the engine");
  if (!isEngineAgent(agent)) throw new Error(`unknown chat agent: ${agent}`);

  if (agent === "operator") {
    // attached parcels/leads become a grounded, cited block on the last user message
    let msgs = messages;
    if (context.length) msgs = appendToLastUser(messages, buildContextBlock(await resolveContext(sql, context)));
    return runAgent(msgs);   // runAgent manages its own sql + tools
  }

  if (agent === "interrogator") {
    const apn = context.find((c) => c.type === "parcel")?.id ?? extractApn(lastUser(messages));
    if (!apn) return { text: "Attach a deal (＋ Add to chat from any parcel) or give me its APN, and I'll run Pace-structures / Grant-challenges on it.", ...EMPTY };
    const { address, review } = await interrogateForApn(sql, "Charlottesville", apn);
    return { text: formatInterrogation(address, apn, review), ...EMPTY };
  }

  // coach
  const leadId = context.find((c) => c.type === "lead")?.id ?? extractLeadId(lastUser(messages));
  if (!leadId) return { text: "Attach a lead (＋ Add to chat from the Leads page) or paste its id, and I'll build the call playbook + objection prep.", ...EMPTY };
  const pb = await buildPlaybookForLead(sql, leadId);
  return { text: formatPlaybook(pb), ...EMPTY };
}

function formatInterrogation(address: string, apn: string, r: DualPersonaReview): string {
  const lines = [
    `**${address}** (${apn}) — interrogated.`, "",
    `🔨 **Pace (structure):** ${r.pace.proposal}`, "",
    `🔎 **Grant (challenges):**`,
    ...r.grant.challenges.map((c) => `- [${c.severity}] ${c.concern}`), "",
    `⚖️ **${r.synthesis.verdict.replace(/_/g, " ").toUpperCase()}** — ${r.synthesis.recommendation}`,
  ];
  if (r.synthesis.openRisks.length) lines.push("", "Open risks:", ...r.synthesis.openRisks.map((x) => `- ${x}`));
  lines.push("", "_Distilled personas from a cited source — informational, not legal/financial advice or the real person._");
  return lines.join("\n");
}

function formatPlaybook(pb: Playbook): string {
  const lines: string[] = [];
  for (const s of pb.sections) {
    lines.push(`**${s.title}**`, ...s.lines, "");
  }
  if (pb.citations.length) lines.push(`_cites: ${pb.citations.join(", ")}_`);
  lines.push(`_${pb.note}_`);
  return lines.join("\n");
}
