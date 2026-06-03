/**
 * Agent tool registry (spec 022). READ tools execute freely (a guarded read-only SQL tool +
 * structured tools that reuse the shipped engine functions). ACTION tools are PROPOSE-ONLY — they
 * return a `{ proposal }` describing what they WOULD do and never cause a side effect; the user
 * approves a proposal and it runs through the existing /api/actions engine + compliance gates.
 */
import { tool } from "ai";
import { z } from "zod";
import type { Sql } from "../db/client.js";
import { prepareReadQuery } from "./safeQuery.js";
import { advisePortfolio } from "../db/portfolio.js";
import { buyAheadShortlist } from "../db/growth.js";
import { interrogateForApn } from "../interrogate/forDeal.js";
import { buildPlaybookForLead } from "../coach/forLead.js";

const MARKET = "Charlottesville";

export interface Proposal {
  kind: "proposal";
  action: string;                 // matches a web /api/actions action name
  params: Record<string, unknown>;
  summary: string;
  requiresApproval: true;
  compliance?: string[];          // for sends: the gate the user must satisfy
}

// ── raw read implementations (testable; the tool() wrappers just bind `sql`) ──────────────────
export async function queryDb(sql: Sql, args: { query: string }): Promise<{ rows?: unknown[]; error?: string }> {
  const p = prepareReadQuery(args.query, 200);
  if (!p.ok) return { error: `query refused: ${p.reason}` };
  try {
    const rows = await sql.unsafe(p.sql);
    return { rows: Array.from(rows).slice(0, 200) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function getParcel(sql: Sql, args: { apn: string }): Promise<unknown> {
  const [row] = await sql`select * from deal_genome where market = ${MARKET} and apn = ${args.apn} limit 1`;
  return row ?? { error: `no parcel ${args.apn}` };
}

export async function getInterrogation(sql: Sql, args: { apn: string }): Promise<unknown> {
  try { const { address, review } = await interrogateForApn(sql, MARKET, args.apn); return { address, ...review }; }
  catch (e) { return { error: (e as Error).message }; }
}

export async function getCoaching(sql: Sql, args: { leadId: string }): Promise<unknown> {
  try { return await buildPlaybookForLead(sql, args.leadId); }
  catch (e) { return { error: (e as Error).message }; }
}

export async function listLeads(sql: Sql, args: { limit?: number; motivationType?: string }): Promise<readonly unknown[]> {
  const lim = Math.min(args.limit ?? 20, 100);
  return sql`
    select l.id, l.stack_score, l.motivation_type, l.likely_bunny, l.recommended_structure,
           l.approach, l.method, l.gate_state, o.name as owner, p.address
    from lead l join market m on m.id = l.market_id
    join owner o on o.id = l.owner_id left join property p on p.id = l.property_id
    where m.name = ${MARKET} and l.gate_state = 'mailable'
      and (${args.motivationType ?? null}::text is null or l.motivation_type = ${args.motivationType ?? null})
    order by l.stack_score desc nulls last limit ${lim}`;
}

// ── propose builders (PURE — no side effect; testable) ────────────────────────────────────────
export const proposeGenerateLeads = (): Proposal =>
  ({ kind: "proposal", action: "generate-leads", params: {}, summary: "Regenerate the mailable lead list", requiresApproval: true });

export const proposeDraftMailer = (leadId: string): Proposal =>
  ({ kind: "proposal", action: "draft-mailer", params: { leadId }, summary: `Draft a direct-mail letter for lead ${leadId}`, requiresApproval: true });

export const proposeEnrichOwner = (apn: string): Proposal =>
  ({ kind: "proposal", action: "enrich-owner", params: { apn }, summary: `Run owner intelligence for ${apn}`, requiresApproval: true });

export const proposeAdvanceDeal = (apn: string, toStage: string): Proposal =>
  ({ kind: "proposal", action: "track-deal", params: { apn, toStage }, summary: `Move ${apn} toward ${toStage}`, requiresApproval: true });

export const proposeEmail = (a: { to: string; subject: string; body: string; isOwner?: boolean }): Proposal => ({
  kind: "proposal", action: "send-email",
  params: { to: a.to, subject: a.subject, body: a.body },
  summary: `Email ${a.to}: ${a.subject}`,
  requiresApproval: true,
  compliance: a.isOwner
    ? ["CAN-SPAM: include a physical mailing address", "CAN-SPAM: include a working unsubscribe/opt-out",
       "route through the compliance gate (DNC/opt-out) — never auto-send; you approve the draft"]
    : ["you approve the draft before it sends"],
});

/** The AI-SDK tool registry, bound to a DB connection. */
export function agentTools(sql: Sql) {
  return {
    query_db: tool({
      description: "Run a READ-ONLY SQL query (SELECT/CTE only) against the LOT database to answer anything it holds — parcels, scores, exit_strategies, owners, leads, deals, growth_area, knowledge. No writes.",
      inputSchema: z.object({ query: z.string().describe("a single SELECT or WITH statement") }),
      execute: (args) => queryDb(sql, args),
    }),
    get_parcel: tool({
      description: "Full scored deal_genome row for one parcel by APN (score, financing, exit_strategies, hbu, owner, risk).",
      inputSchema: z.object({ apn: z.string() }),
      execute: (args) => getParcel(sql, args),
    }),
    list_leads: tool({
      description: "Top mailable leads ranked by stack score, with motivation/bunny/structure/channel.",
      inputSchema: z.object({ limit: z.number().optional(), motivationType: z.string().optional() }),
      execute: (args) => listLeads(sql, args),
    }),
    portfolio_summary: tool({
      description: "The portfolio model (owned holdings, cash flow, concentration) + the best-next-buy recommendation.",
      inputSchema: z.object({}),
      execute: () => advisePortfolio(sql, MARKET),
    }),
    buy_ahead: tool({
      description: "Land-banking shortlist: low-priced parcels in rising growth corridors (spec 017).",
      inputSchema: z.object({ limit: z.number().optional() }),
      execute: (args) => buyAheadShortlist(sql, MARKET, Math.min(args.limit ?? 15, 50)),
    }),
    get_interrogation: tool({
      description: "Interrogate a deal by APN (spec 023): Pace structures it, Grant challenges it, returns the synthesis verdict + open risks. Deterministic.",
      inputSchema: z.object({ apn: z.string() }),
      execute: (args) => getInterrogation(sql, args),
    }),
    get_coaching: tool({
      description: "A cited call playbook + objection prep for a lead by leadId (spec 015). Deterministic.",
      inputSchema: z.object({ leadId: z.string() }),
      execute: (args) => getCoaching(sql, args),
    }),
    // ── propose-only actions (the user approves before anything runs/sends) ──
    propose_generate_leads: tool({ description: "Propose regenerating the lead list (requires approval).", inputSchema: z.object({}), execute: async () => ({ proposal: proposeGenerateLeads() }) }),
    propose_draft_mailer: tool({ description: "Propose drafting a direct-mail letter for a lead (requires approval).", inputSchema: z.object({ leadId: z.string() }), execute: async (a) => ({ proposal: proposeDraftMailer(a.leadId) }) }),
    propose_enrich_owner: tool({ description: "Propose running owner intelligence for a parcel (requires approval).", inputSchema: z.object({ apn: z.string() }), execute: async (a) => ({ proposal: proposeEnrichOwner(a.apn) }) }),
    propose_advance_deal: tool({ description: "Propose moving a parcel into/along the deal pipeline (requires approval).", inputSchema: z.object({ apn: z.string(), toStage: z.string() }), execute: async (a) => ({ proposal: proposeAdvanceDeal(a.apn, a.toStage) }) }),
    propose_email: tool({ description: "Propose an email (to anyone, incl. owners). NEVER sends — returns a draft + compliance the user must satisfy before approving.", inputSchema: z.object({ to: z.string(), subject: z.string(), body: z.string(), isOwner: z.boolean().optional() }), execute: async (a) => ({ proposal: proposeEmail(a) }) }),
  };
}
