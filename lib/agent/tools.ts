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
import { renderDossierForApn } from "../dossier/fromDb.js";
import { loadActiveThesis } from "../db/thesis.js";

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
    // run inside a transaction with a hard statement_timeout so a pathological query (pg_sleep,
    // a giant generate_series) can't hang the request or exhaust the pool. `set local` is scoped
    // to this txn and reset on commit, so it never leaks to other pooled queries.
    const rows = await sql.begin(async (tx) => {
      await tx.unsafe("set local statement_timeout = 5000");   // 5s
      return tx.unsafe(p.sql);
    });
    return { rows: Array.from(rows as Iterable<unknown>).slice(0, 200) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function getParcel(sql: Sql, args: { apn: string }): Promise<unknown> {
  const [row] = await sql`select * from deal_genome where market = ${MARKET} and apn = ${args.apn} limit 1`;
  return row ?? { error: `no parcel ${args.apn}` };
}

// The full CITED dossier (markdown) — re-runs scoring/financing/sensitivity from live data and
// resolves the cited creative-finance rules. Previously CLI-only; now the agent can pull it.
export async function getDossier(sql: Sql, args: { apn: string }): Promise<unknown> {
  try {
    const thesis = await loadActiveThesis(sql);
    if (!thesis) return { error: "no active thesis to render a dossier against" };
    const md = await renderDossierForApn(sql, MARKET, args.apn, thesis);
    return { dossier: md.slice(0, 6000) };   // bounded so it can't blow the context window
  } catch (e) { return { error: (e as Error).message }; }
}

// Retrieval over the distilled corpus (knowledge_note = the ingested playbook/creative-finance/
// glossary; knowledge_rule = the cited deal rules). Lets the agent pull a concept on demand without
// bloating every prompt — the retrieval half of the knowledge layer.
export async function searchKnowledge(sql: Sql, args: { query: string }): Promise<unknown> {
  const q = `%${(args.query ?? "").slice(0, 120)}%`;
  try {
    const notes = await sql`select title, left(body, 700) as body, source from knowledge_note
      where title ilike ${q} or body ilike ${q} order by length(body) limit 5`;
    const rules = await sql`select slug, condition, recommendation, source from knowledge_rule
      where condition ilike ${q} or recommendation ilike ${q} limit 5`;
    return { notes, rules, note: "cite the source when you use one; informational, not legal/financial advice" };
  } catch (e) { return { error: (e as Error).message }; }
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

// The operator can PROPOSE an email — which saves it as a reviewable DRAFT (mail-first, human-approved).
// It never sends here; the actual send happens on /outreach, behind the compliance gate (opt-out /
// gate_state / physical-address check). `save-email-draft` is the real, wired action.
export const proposeEmail = (a: { to: string; subject: string; body: string; leadId?: string; isOwner?: boolean }): Proposal => ({
  kind: "proposal", action: "save-email-draft",
  params: { to: a.to, subject: a.subject, body: a.body, leadId: a.leadId },
  summary: `Save email draft to ${a.to}: ${a.subject}`,
  requiresApproval: true,
  compliance: a.isOwner
    ? ["Saved as a draft — nothing sends here.", "Sending (on /outreach) runs the compliance gate: opt-out / mailability / a real physical address.",
       "CAN-SPAM: a working opt-out + physical mailing address are required before it can send."]
    : ["Saved as a draft for your review — you approve the send."],
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
    get_dossier: tool({
      description: "The full CITED dossier (markdown) for a parcel: scoring, financing with creative-finance guardrails + cited rules, sensitivity, owner situation. Use for a deep, citation-grounded answer about one property.",
      inputSchema: z.object({ apn: z.string() }),
      execute: (args) => getDossier(sql, args),
    }),
    search_knowledge: tool({
      description: "Search LOT's distilled domain knowledge (the playbook, creative-finance plays, glossary, and cited deal rules) for a concept. Use when a question is about strategy/plays/terms rather than a specific parcel.",
      inputSchema: z.object({ query: z.string().describe("a concept or term, e.g. 'subject-to due-on-sale' or 'by-the-room legality'") }),
      execute: (args) => searchKnowledge(sql, args),
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
