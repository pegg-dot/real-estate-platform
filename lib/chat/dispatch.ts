/**
 * Chat dispatch (spec 024) — routes an engine-side chat agent to the capability it wraps and returns
 * a uniform { text, trace, proposals }. The Explainer is NOT here — it answers in-process in the web
 * route (fast Haiku). This module is the engine half (Operator / Interrogator / Coach), reachable via
 * scripts/chat.ts. Pure helpers (extractApn/extractLeadId/isEngineAgent) are unit-tested; the engine
 * calls are integration-verified.
 */
import type { Sql } from "../db/client.js";
import { runAgent, runAnalyst } from "../agent/run.js";
import { interrogateForApn } from "../interrogate/forDeal.js";
import { buildPlaybookForLead } from "../coach/forLead.js";
import { readSituation } from "../enrich/situation.js";
import { llmRoleplayRunner } from "../coach/roleplayLlm.js";
import type { PersonaInput } from "../coach/roleplay.js";
import type { Proposal } from "../agent/tools.js";
import type { DualPersonaReview } from "../interrogate/personas.js";
import type { Playbook } from "../coach/playbook.js";
import { resolveContext, buildContextBlock, appendToLastUser } from "./buildContext.js";
import { draftEmailForLead } from "../outreach/draftEmail.js";
import { proposeEvents } from "../schedule/propose.js";

export type ChatAgentId = "auto" | "explainer" | "operator" | "interrogator" | "coach" | "outreach" | "scheduler" | "analyst" | "roleplay";
const ENGINE = new Set<ChatAgentId>(["auto", "operator", "interrogator", "coach", "outreach", "scheduler", "analyst", "roleplay"]);
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

  if (agent === "operator" || agent === "auto") {
    // the neutral Auto agent shares the operator's full toolset (DB + interrogate + coach + propose)
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

  if (agent === "analyst") {
    let msgs = messages;
    if (context.length) msgs = appendToLastUser(messages, buildContextBlock(await resolveContext(sql, context)));
    return runAnalyst(msgs);   // read-only SQL only; manages its own sql
  }

  if (agent === "roleplay") {
    const leadId = context.find((c) => c.type === "lead")?.id ?? extractLeadId(lastUser(messages));
    const persona = await personaForLead(sql, leadId);
    const history = messages.map((m) => ({ role: m.role === "user" ? ("rep" as const) : ("seller" as const), text: m.content }));
    const { sellerReply, rubric } = await llmRoleplayRunner(history, persona);
    let text = sellerReply;
    if (rubric) {
      const p = (n: number) => `${Math.round(n * 100)}%`;
      text += `\n\n— **Scorecard** — rapport ${p(rubric.rapport)} · discovery ${p(rubric.discovery)} · ` +
        `bunny-found ${p(rubric.bunnyFound)} · structure-fit ${p(rubric.structureFit)} · **overall ${p(rubric.overall)}**` +
        (rubric.notes.length ? `\n${rubric.notes.map((n) => `• ${n}`).join("\n")}` : "");
    }
    return { text, trace: [], proposals: [] };
  }

  if (agent === "scheduler") {
    const leadRef = context.find((c) => c.type === "lead");
    const parcelRef = context.find((c) => c.type === "parcel");
    let label: string | undefined;
    if (parcelRef) { const [p] = await sql<Array<{ address: string | null }>>`select address from deal_genome where market = 'Charlottesville' and apn = ${parcelRef.id} limit 1`; label = p?.address ?? `parcel ${parcelRef.id}`; }
    else if (leadRef) { const [l] = await sql<Array<{ label: string | null }>>`select coalesce(p.address, o.name) as label from lead l join owner o on o.id = l.owner_id left join property p on p.id = l.property_id where l.id = ${leadRef.id} limit 1`; label = l?.label ?? "this lead"; }
    const events = proposeEvents({ text: lastUser(messages), now: new Date(), leadId: leadRef?.id, apn: parcelRef?.id, label });
    if (!events.length) return { text: "Tell me when (e.g. \"call them Tuesday\", \"follow up in 2 weeks\", \"visit next Friday\") or attach a lead/parcel and I'll propose a follow-up cadence.", ...EMPTY };
    const proposals: Proposal[] = events.map((e) => ({
      kind: "proposal", action: "schedule-event",
      params: { title: e.title, kind: e.kind, when: e.when, notes: e.notes, leadId: leadRef?.id, apn: parcelRef?.id },
      summary: `${e.title} · ${e.when.slice(0, 10)}`, requiresApproval: true,
    }));
    const text = `Proposed:\n${events.map((e) => `- ${e.title} · ${e.when.slice(0, 10)}`).join("\n")}\n\nApprove each to add it to your Schedule. (Calendar sync lights up when the Google Calendar connector is wired.)`;
    return { text, trace: [], proposals };
  }

  if (agent === "outreach") {
    const leadId = context.find((c) => c.type === "lead")?.id ?? extractLeadId(lastUser(messages));
    if (!leadId) return { text: "Attach a lead (＋ Add to chat from the Leads page) or paste its id, and I'll draft a CAN-SPAM-compliant, situation-personalized owner email for you to review.", ...EMPTY };
    const d = await draftEmailForLead(sql, leadId);
    const manualReview = d.entityType === "estate" || d.entityType === "trust"
      ? "\n\n⚠️ Estate/trust owner — this routes to the manual-review lane; double-check before sending (probate sensitivity)." : "";
    const text = `Drafted an email${d.to ? ` to ${d.to}` : " (no owner email on file yet — add a recipient before sending)"}:\n\n**${d.subject}**\n\n${d.body}${manualReview}\n\nReview + approve below — nothing sends until you do (and a Gmail connector is wired).`;
    const proposal: Proposal = {
      kind: "proposal", action: "save-email-draft",
      params: { leadId, to: d.to, subject: d.subject, body: d.body },
      summary: `Save email draft${d.to ? ` to ${d.to}` : ""}`, requiresApproval: true,
      compliance: ["CAN-SPAM: physical address + opt-out are included", "never auto-sends — saved as a draft for your review"],
    };
    return { text, trace: [], proposals: [proposal] };
  }

  // coach
  const leadId = context.find((c) => c.type === "lead")?.id ?? extractLeadId(lastUser(messages));
  if (!leadId) return { text: "Attach a lead (＋ Add to chat from the Leads page) or paste its id, and I'll build the call playbook + objection prep.", ...EMPTY };
  const pb = await buildPlaybookForLead(sql, leadId);
  return { text: formatPlaybook(pb), ...EMPTY };
}

/** Build the seller persona for the roleplay from a lead (generic tired-landlord if none). */
async function personaForLead(sql: Sql, leadId: string | null): Promise<PersonaInput> {
  const generic: PersonaInput = { motivationType: "tired_landlord", likelyBunny: "keep_income",
    approach: "A worn-down, long-tenure landlord — lead with empathy and the idea of keeping income without the hassle.", tone: "standard" };
  if (!leadId) return generic;
  const [l] = await sql<Array<{ motivation_type: string | null; likely_bunny: string | null; owner_name: string | null;
    entity_type: string | null; is_absentee: boolean | null; tenure_years: number | null }>>`
    select l.motivation_type, l.likely_bunny, o.name as owner_name, o.entity_type, o.is_absentee, o.tenure_years
    from lead l join owner o on o.id = l.owner_id where l.id = ${leadId} limit 1`;
  if (!l) return generic;
  const sit = readSituation({ entityType: l.entity_type, tenureYears: l.tenure_years != null ? Number(l.tenure_years) : null,
    isAbsentee: l.is_absentee, portfolioCount: 1, distressCount: 0, estEquityPct: null });
  return {
    ownerName: l.owner_name, motivationType: l.motivation_type ?? "tired_landlord",
    likelyBunny: l.likely_bunny ?? "keep_income", approach: sit.approach, tone: sit.tone,
  };
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
