/**
 * Agent loop (spec 022) — the Claude-Code-style operator. One user message -> a multi-step tool-use
 * loop (read tools execute; action tools only PROPOSE) -> a grounded answer + the tool trace + the
 * proposals the user can approve. Gated on Anthropic credits; degrades with a clear, catchable error.
 */
import { generateText, streamText, stepCountIs } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { getSql } from "../db/client.js";
import { agentTools, type Proposal } from "./tools.js";

/** The structured tail of a streamed agent turn (the visible text is delivered via onText). */
export interface AgentStreamTail {
  trace: Array<{ tool: string; args: unknown }>;
  proposals: Proposal[];
}

const SYSTEM = `You are LOT's operator agent for Nate — an AI-native buy-and-hold rental tool
(Charlottesville/UVA student rentals, all-cash via a family trust, long horizon).

You are the neutral, do-anything agent — decide what's needed and use the right tool(s); one turn
can explain, query, interrogate, coach, and propose. You can:
- READ anything in the database via query_db (read-only SQL) + structured tools (get_parcel,
  list_leads, portfolio_summary, buy_ahead, get_interrogation, get_coaching). Pull real data and
  cite it; never make up numbers. get_interrogation(apn) = Pace-structures/Grant-challenges a deal;
  get_coaching(leadId) = a cited call playbook.
- EXPLAIN plainly when asked (you also know the plays): bird-dogging, wholesaling, cash, seller-
  finance (free-and-clear owners / defer cap gains; Dodd-Frank/SAFE if a consumer-occupant),
  subject-to (take the deed, keep their low-rate loan; due-on-sale + Garn-St-Germain caveat, always
  an attorney), hybrid. Reading sellers: long-tenure+absentee=tired landlord; estate/trust=inherited,
  be gentle; high-equity+long-hold=cap-gains pitch; low-equity/behind=subject-to.
- PROPOSE actions (propose_*). You CANNOT write or send anything yourself — every action is a
  proposal the user approves first. NEVER say you "sent", "ran", or "did" an action — say you've
  PROPOSED it and it's awaiting their approval.

Be concrete and concise. When you propose an action, explain why from the data. Creative finance and
outreach carry legal guardrails — surface the due-on-sale / Dodd-Frank caveats, say "informational,
not legal advice", and remember outreach is mail-first and never auto-sent. Owner emails must satisfy
CAN-SPAM and route through the compliance gate.`;

export interface AgentResult {
  text: string;
  trace: Array<{ tool: string; args: unknown }>;
  proposals: Proposal[];
}

// Sandboxed Analyst (spec 025-D): read-only SQL only (the safeQuery boundary is the sandbox).
const ANALYST_SYSTEM = `You are LOT's data analyst. Answer with NUMBERS pulled from the database via
query_db — read-only SQL, SELECT/CTE only, no writes (the tool refuses writes). Write the query, read
the rows, and present a tight answer: a small markdown table or a one-line stat + one sentence of
insight. NEVER invent numbers; if a query returns nothing, say so and suggest a refinement. Useful
tables/columns: deal_genome (apn, address, score, headline_coc, est_market_value, beds, by_room_legal,
zone_code, recommended_structure, recommended_use, lat, lng, components, exit_strategies), lead, owner,
deal, growth_area, distress_signal.`;

export async function runAnalyst(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<AgentResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set — the analyst needs Anthropic billing to run.");
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const sql = getSql();
  try {
    const { query_db } = agentTools(sql);   // read-only SQL tool only — no proposes, no writes
    const { text, steps } = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      system: ANALYST_SYSTEM, messages, tools: { query_db }, stopWhen: stepCountIs(6),
    });
    const trace = steps.flatMap((s) => s.toolCalls.map((c) => ({ tool: c.toolName, args: c.input })));
    return { text, trace, proposals: [] };
  } finally {
    await sql.end();
  }
}

export async function runAgent(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<AgentResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set — the agent needs Anthropic billing to run.");
  }
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const sql = getSql();
  try {
    const { text, steps } = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      system: SYSTEM,
      messages,
      tools: agentTools(sql),
      stopWhen: stepCountIs(8),
    });
    const trace = steps.flatMap((s) => s.toolCalls.map((c) => ({ tool: c.toolName, args: c.input })));
    const proposals = steps.flatMap((s) =>
      s.toolResults
        .map((r) => (r.output as { proposal?: Proposal } | undefined)?.proposal)
        .filter((p): p is Proposal => !!p));
    return { text, trace, proposals };
  } finally {
    await sql.end();
  }
}

// ---- Streaming variants (spec 024 streaming follow-up) ----
// Same tool loop and guardrails as above, but the model's visible answer is delivered token-by-token
// via onText while it generates; the structured tail (trace + proposals) is returned once the loop
// finishes. The operator's proposals still only PROPOSE — streaming changes delivery, not authority.

/** Stream the operator/auto agent: visible text via onText, returns the trace + proposals tail. */
export async function streamAgent(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  onText: (delta: string) => void,
): Promise<AgentStreamTail> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set — the agent needs Anthropic billing to run.");
  }
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const sql = getSql();
  try {
    const result = streamText({
      model: anthropic("claude-sonnet-4-6"),
      system: SYSTEM, messages, tools: agentTools(sql), stopWhen: stepCountIs(8),
    });
    for await (const delta of result.textStream) onText(delta);
    const steps = await result.steps;
    const trace = steps.flatMap((s) => s.toolCalls.map((c) => ({ tool: c.toolName, args: c.input })));
    const proposals = steps.flatMap((s) =>
      s.toolResults
        .map((r) => (r.output as { proposal?: Proposal } | undefined)?.proposal)
        .filter((p): p is Proposal => !!p));
    return { trace, proposals };
  } finally {
    await sql.end();
  }
}

/** Stream the sandboxed Analyst (read-only SQL only; never proposes). */
export async function streamAnalyst(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  onText: (delta: string) => void,
): Promise<AgentStreamTail> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set — the analyst needs Anthropic billing to run.");
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const sql = getSql();
  try {
    const { query_db } = agentTools(sql);   // read-only SQL tool only — no proposes, no writes
    const result = streamText({
      model: anthropic("claude-sonnet-4-6"),
      system: ANALYST_SYSTEM, messages, tools: { query_db }, stopWhen: stepCountIs(6),
    });
    for await (const delta of result.textStream) onText(delta);
    const steps = await result.steps;
    const trace = steps.flatMap((s) => s.toolCalls.map((c) => ({ tool: c.toolName, args: c.input })));
    return { trace, proposals: [] };
  } finally {
    await sql.end();
  }
}
