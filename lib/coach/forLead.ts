/**
 * Assemble a call playbook for a specific lead (spec 015 Part B, DB glue) — pulls the lead's
 * inferred motivation/bunny/structure, the owner situation read (014), the financing cap-gains
 * number (004), and cited objection exemplars (016), then hands them to the pure buildPlaybook.
 */
import type { Sql } from "../db/client.js";
import { buildPlaybook, type Playbook, type ObjectionExemplar } from "./playbook.js";

export async function buildPlaybookForLead(sql: Sql, leadId: string): Promise<Playbook> {
  const [lead] = await sql<Array<{
    owner_id: string; property_id: string | null; motivation_type: string | null;
    likely_bunny: string | null; recommended_structure: string | null; owner_name: string | null;
  }>>`
    select l.owner_id, l.property_id, l.motivation_type, l.likely_bunny, l.recommended_structure,
           o.name as owner_name
    from lead l join owner o on o.id = l.owner_id where l.id = ${leadId}`;
  if (!lead) throw new Error(`no lead ${leadId}`);

  const [sit] = await sql<Array<{ detail: { approach?: string } }>>`
    select detail from owner_intel where owner_id = ${lead.owner_id} and category = 'situation' limit 1`;

  const [fin] = await sql<Array<{ financing: { recommended?: Array<{ capGains?: { sellerBenefit?: number } }> } }>>`
    select financing from property_score
    where property_id = ${lead.property_id} and thesis_version = (select version from thesis where is_active limit 1)
    limit 1`;
  const capGains = fin?.financing?.recommended?.[0]?.capGains?.sellerBenefit ?? null;

  // cited objection exemplars from the expert-mind layer, best-weighted first (outcome loop)
  const exemplars = await sql<ObjectionExemplar[]>`
    select key, response, coalesce(source, 'unknown') as source from knowledge_exemplar
    where key like 'objection#%' order by weight desc, corroboration desc limit 4`;

  return buildPlaybook({
    ownerName: lead.owner_name,
    motivationType: lead.motivation_type ?? "none",
    likelyBunny: lead.likely_bunny ?? "none",
    recommendedStructure: (lead.recommended_structure ?? "cash") as "cash" | "seller_finance" | "subject_to",
    approach: sit?.detail?.approach ?? "A simple, no-pressure cash option: speed and certainty.",
    capGainsBenefit: capGains,
    objectionExemplars: exemplars,
  });
}
