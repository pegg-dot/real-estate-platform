/**
 * Outreach Writer (spec 025-B) — drafts a situation-personalized owner email with the CAN-SPAM
 * footer baked in. Deterministic (works at $0 credits). The draft is a PROPOSAL the user reviews;
 * nothing sends until a Gmail/email connector is wired. composeEmail/canSpamFooter are pure +
 * unit-tested; draftEmailForLead gathers the lead's facts and calls them.
 */
import type { Sql } from "../db/client.js";
import { readSituation } from "../enrich/situation.js";

export interface EmailDraft { to: string; subject: string; body: string; leadId: string; entityType: string | null }

// CAN-SPAM requires a physical mailing address + a working opt-out. The address comes from
// OUTREACH_SENDER_ADDRESS; when unset we emit this sentinel so the SEND path can hard-refuse to
// ship a non-compliant email (a blank/placeholder address is itself a CAN-SPAM violation).
export const NO_SENDER_ADDRESS = "[[SET OUTREACH_SENDER_ADDRESS]]";
const SENDER_ADDRESS = process.env.OUTREACH_SENDER_ADDRESS || NO_SENDER_ADDRESS;

export function canSpamFooter(): string {
  return `\n\n—\n${SENDER_ADDRESS}\n` +
    `You received this because you own property in our buying area. ` +
    `Reply STOP or "unsubscribe" and we won't contact you again.`;
}

export function composeEmail(f: {
  ownerName: string | null; address: string | null; approach: string;
  structure: string | null; sellerWin?: string | null;
}): { subject: string; body: string } {
  // owner names are usually "LAST, FIRST"; greet by first name. Entity owners (LLC/trust) → "there".
  const raw = (f.ownerName ?? "").trim();
  const first = raw && !/\b(llc|inc|trust|estate|assoc|company|corp|properties|ltd|fund|partners)\b/i.test(raw)
    ? (raw.includes(",") ? (raw.split(",")[1] ?? "").trim() : raw).split(/\s+/).filter(Boolean)[0] || null
    : null;
  const subject = f.address ? `About your property at ${f.address}` : "About your property";
  const body = `Hi ${first ?? "there"},\n\n` +
    `${f.approach}\n\n` +
    (f.sellerWin ? `${f.sellerWin}\n\n` : "") +
    `No pressure and no obligation — if it's worth a short conversation, just reply and we'll work ` +
    `around your timing. If not, I completely understand.\n\nThanks for your time.` +
    canSpamFooter();
  return { subject, body };
}

export async function draftEmailForLead(sql: Sql, leadId: string): Promise<EmailDraft> {
  const [lead] = await sql<Array<{
    owner_id: string; recommended_structure: string | null; owner_name: string | null;
    entity_type: string | null; is_absentee: boolean | null; tenure_years: number | null; address: string | null;
  }>>`
    select l.owner_id, l.recommended_structure, o.name as owner_name, o.entity_type, o.is_absentee,
           o.tenure_years, p.address
    from lead l join owner o on o.id = l.owner_id left join property p on p.id = l.property_id
    where l.id = ${leadId} limit 1`;
  if (!lead) throw new Error(`no lead ${leadId}`);

  const sit = readSituation({
    entityType: lead.entity_type, tenureYears: lead.tenure_years != null ? Number(lead.tenure_years) : null,
    isAbsentee: lead.is_absentee, portfolioCount: 1, distressCount: 0, estEquityPct: null,
  });

  // owner email from prior enrichment (if any); otherwise left blank for the user to fill
  const [contact] = await sql<Array<{ detail: { emails?: string[] } }>>`
    select detail from owner_intel where owner_id = ${lead.owner_id} and category = 'contact' limit 1`;
  const to = contact?.detail?.emails?.[0] ?? "";

  const sellerWin = lead.recommended_structure === "seller_finance"
    ? "Selling on terms could defer a chunk of your capital-gains tax and pay you monthly — you net more and keep income."
    : lead.recommended_structure === "subject_to"
      ? "There may be a way to take over the payments so you walk away clean, without a big check to write."
      : null;

  const { subject, body } = composeEmail({ ownerName: lead.owner_name, address: lead.address, approach: sit.approach, structure: lead.recommended_structure, sellerWin });
  return { to, subject, body, leadId, entityType: lead.entity_type };
}
