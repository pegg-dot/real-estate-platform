/**
 * Sourcing + outreach DB layer (spec 009 / Phase 4 004c).
 *
 * The closed funnel: generate owner-collapsed leads (motivation-scored, by-room-viable only)
 * -> select a throttled weekly mail batch -> approve a mailer (which MUST pass the
 * complianceGate, draft via the financing engine, and log an outreach_event) -> a deal is born
 * ONLY when an inbound reply arrives (recordInbound), keeping the pipeline meaning "things I'm
 * pursuing", not "everyone I mailed". Mail-only; nothing is ever auto-sent.
 */
import type postgres from "postgres";
import type { Sql } from "./client.js";
import { motivationScore } from "../sourcing/motivation.js";
import { assertCompliant } from "../outreach/complianceGate.js";
import { draftMailer } from "../outreach/draft.js";
import { createDeal } from "./deal.js";

type Json = postgres.JSONValue;

export interface SourcingConfig {
  weeklyMailBudget: number; lifetimeMailCap: number; cooldownDays: number; outreachEnabled: boolean;
}

/** Load the market's sourcing config, seeding Nate's defaults if none exists. */
export async function getSourcingConfig(sql: Sql, market: string): Promise<SourcingConfig> {
  const [row] = await sql<{ weekly_mail_budget: number; lifetime_mail_cap: number;
    cooldown_days: number; outreach_enabled: boolean }[]>`
    select c.weekly_mail_budget, c.lifetime_mail_cap, c.cooldown_days, c.outreach_enabled
    from sourcing_config c join market m on m.id = c.market_id where m.name = ${market}`;
  if (row) {
    return { weeklyMailBudget: row.weekly_mail_budget, lifetimeMailCap: row.lifetime_mail_cap,
      cooldownDays: row.cooldown_days, outreachEnabled: row.outreach_enabled };
  }
  await sql`insert into sourcing_config (market_id) select id from market where name = ${market}`;
  return { weeklyMailBudget: 10, lifetimeMailCap: 4, cooldownDays: 90, outreachEnabled: true };
}

/**
 * Generate / refresh owner-collapsed leads for a market: one lead per owner, scored on their
 * BEST by-room-legal parcel. Estate -> manual_review; institution excluded pre-query.
 * Returns the number of leads upserted.
 */
export async function generateLeads(sql: Sql, market: string): Promise<number> {
  const [m] = await sql<{ id: string }[]>`select id from market where name = ${market}`;
  if (!m) throw new Error(`unknown market: ${market}`);

  // one row per (owner, their best-scoring by-room-legal parcel), with a per-parcel distress score
  const rows = await sql<Array<{ owner_id: string; entity_type: string | null;
    is_absentee: boolean | null; tenure_years: number | null; property_id: string;
    score: number | null; thesis_version: number | null; distress_score: number | null }>>`
    select distinct on (o.id)
      o.id as owner_id, o.entity_type, o.is_absentee, o.tenure_years,
      p.id as property_id, ps.score, ps.thesis_version, d.distress_score
    from owner o
    join property p on p.owner_id = o.id
    join market m on m.id = p.market_id
    left join property_score ps on ps.property_id = p.id
      and ps.thesis_version = (select version from thesis where is_active limit 1)
    left join (
      -- 0..1 visible-neglect score per parcel: severity of the strongest signal + a small bump
      -- for repeat complaints (recurring neglect is a stronger tell)
      select property_id, least(1.0,
        max(case severity when 'high' then 0.9 when 'medium' then 0.6 else 0.3 end)
        + 0.1 * (count(*) - 1)) as distress_score
      from distress_signal group by property_id
    ) d on d.property_id = p.id
    where m.name = ${market} and p.by_room_legal is true and o.entity_type <> 'institution'
    order by o.id, ps.score desc nulls last`;
  if (rows.length === 0) return 0;

  const records = rows.map((r) => {
    const mot = motivationScore({
      tenureYears: r.tenure_years, isAbsentee: r.is_absentee,
      entityType: r.entity_type, byRoomLegal: true,
      distressScore: r.distress_score != null ? Number(r.distress_score) : null,
    });
    const gateState = !mot.eligible ? "excluded" : mot.routeManualReview ? "manual_review" : "mailable";
    const segment = r.is_absentee ? "absentee" : (r.tenure_years ?? 0) >= 15 ? "long_tenure" : "owner_occupant";
    return {
      market_id: m.id, owner_id: r.owner_id, property_id: r.property_id,
      motivation_score: mot.score,
      score_provenance: sql.json({ subScores: mot.subScores, reasons: mot.reasons } as Json),
      gate_state: gateState, segment, thesis_version: r.thesis_version,
    };
  });

  // chunked bulk upsert (one round-trip per 500, not per owner)
  const CHUNK = 500;
  for (let i = 0; i < records.length; i += CHUNK) {
    const slice = records.slice(i, i + CHUNK);
    await sql`
      insert into lead ${sql(slice, "market_id", "owner_id", "property_id", "motivation_score",
        "score_provenance", "gate_state", "segment", "thesis_version")}
      on conflict (owner_id) do update set
        property_id = excluded.property_id, motivation_score = excluded.motivation_score,
        score_provenance = excluded.score_provenance, gate_state = excluded.gate_state,
        segment = excluded.segment, thesis_version = excluded.thesis_version`;
  }
  return records.length;
}

export interface MailBatchRow {
  leadId: string; ownerId: string; propertyId: string | null;
  ownerName: string | null; address: string | null; motivationScore: number;
  timesMailed: number;
}

/**
 * The throttled weekly mail queue: mailable, non-opted-out leads not in cooldown and under the
 * lifetime cap, ranked by motivation, capped at the weekly budget. Pure-ish query (no sends).
 */
export async function selectMailBatch(sql: Sql, market: string): Promise<MailBatchRow[]> {
  const cfg = await getSourcingConfig(sql, market);
  if (!cfg.outreachEnabled) return [];
  const rows = await sql<Array<{ lead_id: string; owner_id: string; property_id: string | null;
    owner_name: string | null; address: string | null; motivation_score: number; times_mailed: number }>>`
    select l.id as lead_id, l.owner_id, l.property_id, o.name as owner_name, p.address,
           l.motivation_score, l.times_mailed
    from lead l
    join market m on m.id = l.market_id
    join owner o on o.id = l.owner_id
    left join property p on p.id = l.property_id
    where m.name = ${market} and l.gate_state = 'mailable' and l.opted_out = false
      and l.times_mailed < ${cfg.lifetimeMailCap}
      and (l.do_not_mail_until is null or l.do_not_mail_until <= now())
      and o.mailing_address is not null   -- only surface actually-mailable leads in the budget
    order by l.motivation_score desc
    limit ${cfg.weeklyMailBudget}`;
  return rows.map((r) => ({ leadId: r.lead_id, ownerId: r.owner_id, propertyId: r.property_id,
    ownerName: r.owner_name, address: r.address, motivationScore: r.motivation_score, timesMailed: r.times_mailed }));
}

/**
 * Approve (draft + gate + log) a mailer for a lead. Runs the complianceGate FIRST — it THROWS
 * on any violation, so a non-compliant mailer can't be created. Drafts the reverse-pro-forma
 * letter from the parcel's financing rec, logs an outreach_event, and advances the lead. Does
 * NOT send (mail-only; Nate physically mails) and does NOT create a deal. Returns the event id.
 */
export async function approveMailer(sql: Sql, market: string, leadId: string): Promise<string> {
  const cfg = await getSourcingConfig(sql, market);
  const [lead] = await sql<Array<{ owner_id: string; property_id: string | null; opted_out: boolean;
    times_mailed: number; owner_name: string | null; mailing_address: string | null;
    gate_state: string; do_not_mail_until: string | null }>>`
    select l.owner_id, l.property_id, l.opted_out, l.times_mailed, o.name as owner_name,
           o.mailing_address, l.gate_state, l.do_not_mail_until
    from lead l join owner o on o.id = l.owner_id where l.id = ${leadId}`;
  if (!lead) throw new Error(`no lead ${leadId}`);

  // structurally enforce the routing decisions at the APPROVAL boundary (not just in the queue):
  // estate -> manual_review, excluded, and cooldown can never be auto-mailed even if approveMailer
  // is called directly with a lead id.
  if (lead.gate_state !== "mailable") {
    throw new Error(`lead ${leadId} is '${lead.gate_state}', not mailable (estate/probate -> manual review; institution/illegal -> excluded)`);
  }
  if (lead.do_not_mail_until && new Date(lead.do_not_mail_until) > new Date()) {
    throw new Error(`lead ${leadId} is in cooldown until ${lead.do_not_mail_until} — do not mail yet`);
  }

  // the gate THROWS if not compliant — nothing past here runs on a violation
  const receipt = assertCompliant({
    channel: "mail", ownerSuppressed: lead.opted_out,
    mailingAddressStale: !lead.mailing_address, timesMailed: lead.times_mailed,
    lifetimeMailCap: cfg.lifetimeMailCap, outreachEnabled: cfg.outreachEnabled,
  });

  // draft from the financing engine's seller pitch (reverse pro-forma)
  const [fin] = lead.property_id
    ? await sql<Array<{ address: string | null; financing: unknown }>>`
        select address, financing from deal_genome where id = ${lead.property_id}`
    : [];
  const rec = (fin?.financing as { recommended?: Array<{ structure?: string; sellerPitch?: string;
    capGains?: { sellerBenefit?: number } }> } | undefined)?.recommended?.[0];
  const mailer = draftMailer({
    ownerName: lead.owner_name, propertyAddress: fin?.address ?? "your property",
    sellerPitch: rec?.sellerPitch, capGainsBenefit: rec?.capGains?.sellerBenefit, structure: rec?.structure,
  });

  const [evt] = await sql<{ id: string }[]>`
    insert into outreach_event (lead_id, owner_id, channel, gate_snapshot, subject, body, status)
    values (${leadId}, ${lead.owner_id}, 'mail', ${sql.json(receipt as unknown as Json)},
            ${mailer.subject}, ${mailer.body}, 'approved') returning id`;
  await sql`update lead set status = 'mailed', times_mailed = times_mailed + 1,
            last_mailed_at = now(), do_not_mail_until = now() + (${cfg.cooldownDays} || ' days')::interval
            where id = ${leadId}`;
  return evt!.id;
}

/**
 * Record an inbound reply -> create the deal (the SOLE place a deal is born from sourcing) and
 * capture opt-out/consent. Mail-only: an inbound text/call is NOT blanket consent — we only
 * record the reply and create the deal; telephony stays gated.
 */
export async function recordInbound(
  sql: Sql, opts: { leadId: string; optOut?: boolean; note?: string; outreachId?: string | null },
): Promise<{ dealId: string | null }> {
  const [lead] = await sql<Array<{ owner_id: string; property_id: string | null }>>`
    select owner_id, property_id from lead where id = ${opts.leadId}`;
  if (!lead) throw new Error(`no lead ${opts.leadId}`);

  if (opts.optOut) {
    await sql`update lead set opted_out = true, status = 'dead' where id = ${opts.leadId}`;
    return { dealId: null };
  }
  await sql`update lead set status = 'replied' where id = ${opts.leadId}`;
  if (!lead.property_id) return { dealId: null };

  // funnel link: if the caller didn't pass the mailer id, resolve the lead's most recent one
  let outreachId = opts.outreachId ?? null;
  if (!outreachId) {
    const [evt] = await sql<{ id: string }[]>`
      select id from outreach_event where lead_id = ${opts.leadId} order by created_at desc limit 1`;
    outreachId = evt?.id ?? null;
  }

  const dealId = await createDeal(sql, {
    propertyId: lead.property_id, ownerId: lead.owner_id,
    sourceOutreachId: outreachId,
    reasonChip: "inbound_reply", note: opts.note,
  });
  return { dealId };
}
