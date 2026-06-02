/**
 * Deal pipeline writer (spec 008 / Phase 4 004b) — the ONLY code that mutates deal.stage.
 *
 * Every transition is transactional and: validates the legal-edge matrix, runs the stage
 * gates (legality + guardrail kill-switches), captures the ACTIVE thesis_version at decision
 * time, and appends an immutable deal_decision (the audit trail + LEARN label). Routing every
 * stage change through here is what makes the pipeline's invariants real rather than hopeful.
 */
import type postgres from "postgres";
import type { Sql } from "./client.js";
import {
  isLegalTransition, checkStageGate, actionFor, type Stage,
} from "../pipeline/transitions.js";

type Json = postgres.JSONValue;
type Tx = postgres.TransactionSql<Record<string, never>>;

async function activeThesisVersion(tx: Tx): Promise<number> {
  const [r] = await tx<{ version: number }[]>`select version from thesis where is_active limit 1`;
  if (!r) throw new Error("no active thesis — author one before tracking deals");
  return r.version;
}

/** The engine score for this parcel under this thesis, captured at decision time (frozen). */
async function frozenScore(tx: Tx, propertyId: string, thesisVersion: number): Promise<number | null> {
  const [r] = await tx<{ score: string | null }[]>`
    select score from property_score where property_id = ${propertyId} and thesis_version = ${thesisVersion}`;
  return r?.score != null ? Number(r.score) : null;
}

export interface CreateDealOpts {
  propertyId: string;
  ownerId?: string | null;
  sourceOutreachId?: string | null;   // the mailer this inbound reply came from (funnel link)
  reasonChip?: string;
  note?: string;
  actor?: string;        // 'nate' | 'system' | 'calibration'
}

/** Create a new deal at stage 'watch' + its initial decision-log row. Returns the deal id. */
export async function createDeal(sql: Sql, o: CreateDealOpts): Promise<string> {
  return sql.begin(async (tx) => {
    const tv = await activeThesisVersion(tx);
    const [d] = await tx<{ id: string }[]>`
      insert into deal (property_id, owner_id, source_outreach_id, stage)
      values (${o.propertyId}, ${o.ownerId ?? null}, ${o.sourceOutreachId ?? null}, 'watch') returning id`;
    const dealId = d!.id;
    const fscore = await frozenScore(tx, o.propertyId, tv);
    await tx`
      insert into deal_decision (deal_id, property_id, thesis_version, frozen_score, from_stage, to_stage, action, actor, reason_chip, note)
      values (${dealId}, ${o.propertyId}, ${tv}, ${fscore}, null, 'watch', 'create', ${o.actor ?? "nate"}, ${o.reasonChip ?? null}, ${o.note ?? null})`;
    return dealId;
  }) as Promise<string>;
}

export interface TransitionOpts {
  dealId: string;
  toStage: Stage;
  actor?: string;
  reasonChip?: string;
  reasonIsThesisRelevant?: boolean;
  exogenous?: boolean;
  guardrailAck?: Record<string, unknown>;
  /** caller-computed: would re-running assertGuardrail on the frozen structure throw? */
  guardrailWouldThrow?: boolean;
  /** caller override of the regulatory kill-switch (default: derived from current legality) */
  currentLegalityOk?: boolean;
  note?: string;
  outcome?: Record<string, unknown>;   // written on pass/exit
}

/**
 * Move a deal to a new stage. Throws on an illegal edge or a failed gate (the throw IS the
 * invariant — golden rule #4's guardrail refusal is preserved here, not softened to a click).
 */
export async function transitionDeal(sql: Sql, o: TransitionOpts): Promise<{ from: Stage; to: Stage }> {
  return sql.begin(async (tx) => {
    const [deal] = await tx<{ stage: Stage; property_id: string }[]>`
      select stage, property_id from deal where id = ${o.dealId} for update`;
    if (!deal) throw new Error(`no deal ${o.dealId}`);
    const from = deal.stage;
    const to = o.toStage;

    if (!isLegalTransition(from, to)) {
      throw new Error(`illegal transition ${from} -> ${to}`);
    }

    const [prop] = await tx<{ by_room_legal: boolean | null }[]>`
      select by_room_legal from property where id = ${deal.property_id}`;
    const byRoomLegal = prop?.by_room_legal ?? null;
    const gate = checkStageGate(from, to, {
      byRoomLegal,
      guardrailWouldThrow: o.guardrailWouldThrow ?? false,
      // kill-switch: a deal only freezes if legality is now CONFIRMED illegal (false)
      currentLegalityOk: o.currentLegalityOk ?? byRoomLegal !== false,
    });
    if (!gate.ok) throw new Error(`transition ${from} -> ${to} blocked: ${gate.reason}`);

    const tv = await activeThesisVersion(tx);
    if (o.outcome) {
      await tx`update deal set stage = ${to}, outcome = ${tx.json(o.outcome as Json)}, updated_at = now() where id = ${o.dealId}`;
    } else {
      await tx`update deal set stage = ${to}, updated_at = now() where id = ${o.dealId}`;
    }
    const fscore = await frozenScore(tx, deal.property_id, tv);
    await tx`
      insert into deal_decision
        (deal_id, property_id, thesis_version, frozen_score, from_stage, to_stage, action, actor,
         reason_chip, reason_is_thesis_relevant, exogenous, guardrail_ack, note)
      values (${o.dealId}, ${deal.property_id}, ${tv}, ${fscore}, ${from}, ${to}, ${actionFor(from, to)},
              ${o.actor ?? "nate"}, ${o.reasonChip ?? null}, ${o.reasonIsThesisRelevant ?? false},
              ${o.exogenous ?? false}, ${o.guardrailAck ? tx.json(o.guardrailAck as Json) : null}, ${o.note ?? null})`;
    return { from, to };
  }) as Promise<{ from: Stage; to: Stage }>;
}

/** Find an existing open deal for a property (dedup: one active deal per parcel). */
export async function findDealByProperty(sql: Sql, propertyId: string): Promise<{ id: string; stage: Stage } | null> {
  const [d] = await sql<{ id: string; stage: Stage }[]>`
    select id, stage from deal where property_id = ${propertyId}
    order by created_at desc limit 1`;
  return d ?? null;
}
