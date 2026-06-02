#!/usr/bin/env -S tsx
/**
 * sourcing — the compliant lead funnel CLI (spec 009 / Phase 4 004c).
 *
 *   npm run leads -- --generate                 refresh owner-collapsed, motivation-scored leads
 *   npm run leads -- --queue                     this week's throttled mail queue (top N)
 *   npm run leads -- --draft <leadId>            draft+approve a mailer (runs the complianceGate)
 *   npm run leads -- --inbound <leadId> [--optout]   record a reply (creates a deal, or opts out)
 *   npm run leads -- --config                    show the sourcing config (mail budget, caps)
 *
 * Mail-only. Nothing is ever auto-sent: --draft produces an APPROVED letter for Nate to mail.
 */
import { getSql } from "../lib/db/client.js";
import {
  getSourcingConfig, generateLeads, selectMailBatch, approveMailer, recordInbound,
} from "../lib/db/sourcing.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const next = i >= 0 ? process.argv[i + 1] : undefined;
  return next && !next.startsWith("--") ? next : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const market = arg("market") ?? "Charlottesville";
  const dsn = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!dsn) throw new Error("SUPABASE_DB_URL not set");
  const sql = getSql(dsn);

  try {
    if (flag("config")) {
      console.log(JSON.stringify(await getSourcingConfig(sql, market), null, 2));
    } else if (flag("generate")) {
      console.log(`Generating leads for ${market}…`);
      const n = await generateLeads(sql, market);
      const byGate = await sql`select gate_state, count(*)::int c from lead l join market m on m.id=l.market_id where m.name=${market} group by gate_state order by c desc`;
      console.log(`✓ ${n} leads. By gate: ${(byGate as { gate_state: string; c: number }[]).map((r) => `${r.gate_state}=${r.c}`).join(", ")}`);
    } else if (flag("queue")) {
      const batch = await selectMailBatch(sql, market);
      console.log(`This week's mail queue (${batch.length}):\n`);
      for (const b of batch) {
        console.log(`  [${String(b.motivationScore).padStart(3)}] ${(b.address ?? "—").slice(0, 26).padEnd(26)} ` +
          `${(b.ownerName ?? "owner").slice(0, 22).padEnd(22)} mailed ${b.timesMailed}×  lead=${b.leadId.slice(0, 8)}`);
      }
      if (!batch.length) console.log("  (none — run --generate first, or the budget/cooldown is exhausted)");
    } else if (arg("draft")) {
      const evtId = await approveMailer(sql, market, arg("draft")!);
      const [evt] = await sql<{ subject: string; body: string }[]>`select subject, body from outreach_event where id=${evtId}`;
      console.log(`✓ approved mailer (event ${evtId.slice(0, 8)}) — print + mail it yourself:\n`);
      console.log(`Subject: ${evt!.subject}\n\n${evt!.body}`);
    } else if (arg("inbound")) {
      const res = await recordInbound(sql, { leadId: arg("inbound")!, optOut: flag("optout"), note: arg("note") });
      console.log(flag("optout") ? `✓ opted out — suppressed.` : `✓ reply recorded; deal ${res.dealId?.slice(0, 8) ?? "(no parcel)"} created at 'watch'.`);
    } else {
      console.log("usage: --generate | --queue | --draft <leadId> | --inbound <leadId> [--optout] | --config");
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
