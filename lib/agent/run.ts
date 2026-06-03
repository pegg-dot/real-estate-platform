/**
 * Agent loop (spec 022) — the Claude-Code-style operator. One user message -> a multi-step tool-use
 * loop (read tools execute; action tools only PROPOSE) -> a grounded answer + the tool trace + the
 * proposals the user can approve. Gated on Anthropic credits; degrades with a clear, catchable error.
 */
import { generateText, stepCountIs } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { getSql } from "../db/client.js";
import { agentTools, type Proposal } from "./tools.js";

const SYSTEM = `You are LOT's operator agent for Nate — an AI-native buy-and-hold rental tool
(Charlottesville/UVA student rentals, all-cash via a family trust, long horizon).

You can:
- READ anything in the database via query_db (read-only SQL) + structured tools (get_parcel,
  list_leads, portfolio_summary, buy_ahead). Pull real data and cite it; never make up numbers.
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
