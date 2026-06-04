/**
 * Context-feed resolution (spec 024 Phase 3). Turns the entities the user attached in the composer
 * ({type:'parcel'|'lead', id}) into a grounded, cited prompt block of REAL data, and merges it into
 * the agent's last user message. Pure pieces (buildContextBlock / appendToLastUser) are unit-tested;
 * resolveContext queries the live DB. Never fabricates beyond what the row holds.
 */
import type { Sql } from "../db/client.js";
import type { ChatMsg, ContextRef } from "./dispatch.js";

export interface ResolvedEntity { kind: "parcel" | "lead"; id: string; summary: string }

export function buildContextBlock(entities: ResolvedEntity[]): string {
  if (!entities.length) return "";
  return [
    "The user attached this context — real data from the database. Ground your answer in it and cite it; do NOT fabricate beyond it:",
    ...entities.map((e) => `- ${e.summary}`),
  ].join("\n");
}

/** Merge a context block into the LAST user message (keeps a valid alternating sequence). */
export function appendToLastUser(messages: ChatMsg[], block: string): ChatMsg[] {
  if (!block) return messages;
  const out: ChatMsg[] = messages.map((m) => ({ ...m }));
  for (let i = out.length - 1; i >= 0; i--) {
    const m = out[i];
    if (m && m.role === "user") { out[i] = { role: "user", content: `${m.content}\n\n${block}` }; return out; }
  }
  return out;
}

export async function resolveContext(sql: Sql, refs: ContextRef[]): Promise<ResolvedEntity[]> {
  const out: ResolvedEntity[] = [];
  for (const r of refs) {
    if (r.type === "parcel") {
      const [p] = await sql<Array<{ address: string | null; apn: string; score: number | null; headline_coc: number | null;
        est_market_value: number | null; beds: number | null; by_room_legal: boolean | null; zone_code: string | null;
        recommended_structure: string | null; recommended_use: string | null; recommended_exit_strategy: string | null;
        owner_name: string | null; owner_entity_type: string | null; is_absentee: boolean | null; tenure_years: number | null }>>`
        select address, apn, score, headline_coc, est_market_value, beds, by_room_legal, zone_code,
               recommended_structure, recommended_use, recommended_exit_strategy,
               owner_name, owner_entity_type, is_absentee, tenure_years
        from deal_genome where market = 'Charlottesville' and apn = ${r.id} limit 1`;
      if (p) {
        const usd = (n: number | null) => (n != null ? `$${Math.round(Number(n)).toLocaleString()}` : "—");
        out.push({ kind: "parcel", id: r.id, summary:
          `Parcel ${p.address ?? p.apn} (APN ${p.apn}): score ${p.score != null ? Math.round(Number(p.score)) : "—"}, ` +
          `est value ${usd(p.est_market_value)}, ${p.beds ?? "?"}bd, headline cash-on-cash ` +
          `${p.headline_coc != null ? (Number(p.headline_coc) * 100).toFixed(1) + "%" : "—"}, ` +
          `by-room ${p.by_room_legal ? "legal" : "not legal"} (zone ${p.zone_code ?? "?"}), ` +
          `recommended financing ${(p.recommended_structure ?? "cash").replace(/_/g, " ")}, best use ${(p.recommended_use ?? "hold").replace(/_/g, " ")}, ` +
          `exit ${(p.recommended_exit_strategy ?? "—").replace(/_/g, " ")}. ` +
          `Owner ${p.owner_name ?? "—"}${p.owner_entity_type ? ` (${p.owner_entity_type})` : ""}, ` +
          `${p.is_absentee ? "absentee" : "owner-occupant"}${p.tenure_years != null ? `, held ${Math.round(Number(p.tenure_years))}y` : ""}.` });
      }
    } else if (r.type === "lead") {
      const [l] = await sql<Array<{ name: string | null; entity_type: string | null; is_absentee: boolean | null; tenure_years: number | null;
        motivation_type: string | null; likely_bunny: string | null; recommended_structure: string | null; address: string | null }>>`
        select o.name, o.entity_type, o.is_absentee, o.tenure_years, l.motivation_type, l.likely_bunny, l.recommended_structure, p.address
        from lead l join owner o on o.id = l.owner_id left join property p on p.id = l.property_id
        where l.id = ${r.id} limit 1`;
      if (l) out.push({ kind: "lead", id: r.id, summary:
        `Lead: ${l.name ?? "—"}${l.entity_type ? ` (${l.entity_type})` : ""} at ${l.address ?? "—"} — ` +
        `${l.is_absentee ? "absentee" : "owner-occupant"}${l.tenure_years != null ? `, held ${Math.round(Number(l.tenure_years))}y` : ""}, ` +
        `motivation ${(l.motivation_type ?? "—").replace(/_/g, " ")}, likely bunny ${(l.likely_bunny ?? "—").replace(/_/g, " ")}, ` +
        `recommended ${(l.recommended_structure ?? "—").replace(/_/g, " ")}.` });
    }
  }
  return out;
}
