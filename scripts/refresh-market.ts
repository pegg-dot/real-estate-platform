#!/usr/bin/env -S tsx
/**
 * refresh-market — the orchestrated weekly loop (spec 006, first real cut).
 *
 * SENSE -> REASON -> SHOW -> SCOUT in one command:
 *   1. ingest county data (Python loader) into Postgres
 *   2. score + recommend financing for every property (the TS bridge)
 *   3. print a digest: top opportunities for Nate's thesis
 *   4. SCOUT: snapshot this run + diff vs last run → "what changed this week"
 *   5. RADAR: turn any zoning-rule change into an alpha signal
 *
 * Usage:
 *   SUPABASE_DB_URL=postgres://... npx tsx scripts/refresh-market.ts --market Charlottesville --limit 50 [--geocode] [--skip-ingest]
 *   ... --changes   show the last run's change feed (no rescore)
 *   ... --radar      run the regulatory radar against config/zoning/<market>.json
 *   ... --dossier <apn>   render one cited dossier
 *
 * This is what the `run-market-refresh` skill invokes. Cron/Edge-Function scheduling later.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import type { Sql } from "../lib/db/client.js";
import { getSql } from "../lib/db/client.js";
import { seedKnowledgeRules, seedExpertProfiles } from "../lib/db/knowledge.js";
import { loadActiveThesis, saveThesis } from "../lib/db/thesis.js";
import { genericThesis } from "../lib/thesis/compile.js";
import { scoreMarket, type Thesis } from "../lib/pipeline/scoreMarket.js";
import { loadMarketAssumptions } from "../lib/config/assumptions.js";
import { landlordLawGate } from "../lib/market/landlordLaw.js";
import { renderDossierForApn } from "../lib/dossier/fromDb.js";
import { runScout, showLatestChanges } from "../lib/scout/run.js";
import { runRegulatoryRadar } from "../lib/db/radar.js";
import { loadZoningRules } from "../lib/radar/config.js";
import { renderRegulatoryDigest } from "../lib/radar/digest.js";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const next = i >= 0 ? process.argv[i + 1] : undefined;
  // a value that looks like another flag means the value was omitted (don't misparse it)
  return next && !next.startsWith("--") ? next : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

/** Use the ACTIVE thesis from the DB; if none has been authored yet, seed the generic as v1. */
async function resolveThesis(sql: Sql): Promise<Thesis> {
  let active = await loadActiveThesis(sql);
  if (!active) {
    const g = genericThesis();
    const version = await saveThesis(sql, g);
    active = { ...g, version };
    console.log(`      (no thesis yet — seeded the generic default as v${version})`);
  }
  return {
    version: active.version,
    goal: {
      preferred_cash_on_cash: active.goal.preferred_cash_on_cash,
      min_cash_on_cash: active.goal.min_cash_on_cash,
    },
    scoring_weights: { ...active.scoring_weights },
    hard_constraints: active.hard_constraints,
  };
}

async function main() {
  const market = arg("market", "Charlottesville")!;
  const limit = arg("limit", "50")!;
  const dsn = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!dsn) throw new Error("SUPABASE_DB_URL not set — cannot refresh.");

  // --dossier <apn>: render one cited dossier from the DB and exit (no ingest/score)
  const dossierApn = arg("dossier");
  if (dossierApn) {
    const sql = getSql(dsn);
    await seedKnowledgeRules(sql);
    console.log(await renderDossierForApn(sql, market, dossierApn, await resolveThesis(sql)));
    await sql.end();
    return;
  }

  // --changes: show the latest run's change feed without rescoring, and exit
  if (flag("changes")) {
    const sql = getSql(dsn);
    console.log(await showLatestChanges(sql, market));
    await sql.end();
    return;
  }

  // --radar: run the regulatory radar against config/zoning/<market>.json, and exit
  if (flag("radar")) {
    const sql = getSql(dsn);
    const rules = loadZoningRules(market);
    if (!rules) {
      console.log(`No config/zoning/${market.toLowerCase()}.json — nothing for the radar to read.`);
    } else {
      const { events } = await runRegulatoryRadar(sql, market, rules);
      console.log(renderRegulatoryDigest(events));
    }
    await sql.end();
    return;
  }

  // 1. SENSE — ingest (skip with --skip-ingest if the DB is already fresh)
  if (!flag("skip-ingest")) {
    const where = arg("where", "IsActive=1")!;
    console.log(`[1/3] ingesting ${market} (where "${where}", limit ${limit})…`);
    const pyArgs = ["-m", "ingestion.load_supabase", "--where", where, "--limit", limit];
    if (flag("geocode")) pyArgs.push("--geocode");
    if (flag("flood")) pyArgs.push("--flood");
    if (flag("no-history")) pyArgs.push("--no-history");
    const py = fs.existsSync(".venv/bin/python") ? ".venv/bin/python" : "python3";
    execFileSync(py, pyArgs, { stdio: "inherit", env: { ...process.env, SUPABASE_DB_URL: dsn } });
    // distress signals (free MyCvilleRequests neglect complaints -> distress_signal -> motivation lift)
    if (flag("distress")) {
      console.log(`      + distress signals…`);
      execFileSync(py, ["-m", "ingestion.distress"], { stdio: "inherit", env: { ...process.env, SUPABASE_DB_URL: dsn } });
    }
  }

  // 2. REASON — seed the cited knowledge rules, then score + finance
  console.log(`[2/3] scoring ${market}…`);
  // market-selection guardrail (004): screen the state's landlord-law posture before underwriting
  const law = landlordLawGate(loadMarketAssumptions(market).state);
  if (!law.pass) console.log(`      ⛔ landlord-law: AVOID — ${law.reason} (this market is tenant-favorable; reconsider)`);
  else if (law.warn) console.log(`      ⚠️  landlord-law: CAUTION — ${law.reason}`);
  else console.log(`      ✓ landlord-law: ${law.tier} — ${law.reason}`);
  const sql = getSql(dsn);
  await seedKnowledgeRules(sql);   // so every financing citation resolves to real text
  await seedExpertProfiles(sql);   // Pace/Grant profiles for the deal-interrogation engine (spec 023)
  const thesis = await resolveThesis(sql);
  const res = await scoreMarket(sql, { market, thesis });
  console.log(`      scored ${res.scored} · non-target(institution) ${res.nonTarget} · ` +
    `no-value ${res.skipped} · low-confidence(no beds) ${res.lowConfidence}`);

  // 3. SHOW — only CONFIDENT opportunities (low-confidence pro-formas are a guess, not ranked here)
  // Confidence-weighted shortlist: a thin/modeled deal shouldn't out-rank a fully-real one
  // at the same headline score. Gate-flagged deals are SHOWN (not hidden), tagged inline.
  const top = await sql<{ apn: string; address: string | null; score: number; headline_coc: number;
                          coc_low: number | null; coc_high: number | null; data_confidence: number | null;
                          gate_passed: boolean; gate_failures: string[];
                          by_room_legal: boolean | null; recommended_structure: string;
                          owner_entity_type: string | null; is_absentee: boolean | null }[]>`
    select apn, address, score, headline_coc, coc_low, coc_high, data_confidence,
           gate_passed, gate_failures, by_room_legal, recommended_structure, owner_entity_type, is_absentee
    from deal_genome
    where market = ${market} and score is not null and low_confidence = false
    order by score * coalesce(data_confidence, 0.5) desc
    limit 12`;
  const lowCount = res.lowConfidence;
  // flag-don't-hide: count gate-flagged confident deals that DIDN'T make the top 12, so Nate
  // knows they exist (they're shown, just below the cut) rather than silently dropped.
  const flaggedInTop = top.filter((r) => !r.gate_passed).length;
  const [{ flagged_total }] = await sql<{ flagged_total: number }[]>`
    select count(*)::int as flagged_total from deal_genome
    where market = ${market} and score is not null and low_confidence = false and gate_passed = false`;
  const flaggedBelowCut = Number(flagged_total) - flaggedInTop;
  if (top.length === 0) {
    console.log(`[3/3] no confident opportunities in this slice (${lowCount} low-confidence — need beds/rent data).`);
    console.log(`      tip: target residential parcels, e.g. --where "StreetName LIKE '%GRADY%'"`);
  } else {
    console.log(`[3/3] top opportunities (confidence-weighted; ${lowCount} low-confidence hidden; ` +
      `⚠ = trips a thesis constraint, shown anyway):\n`);
  }
  const pct = (x: number | null) => (x != null ? `${(Number(x) * 100).toFixed(1)}%` : "—");
  for (const r of top) {
    const range = r.coc_low != null ? `(${pct(r.coc_low)}–${pct(r.coc_high)})` : "";
    const flag = r.gate_passed ? "" : `  ⚠ ${(r.gate_failures?.[0] ?? "constraint").slice(0, 40)}`;
    console.log(
      `  ${String(r.score).padStart(5)}  ${(r.address ?? r.apn).slice(0, 22).padEnd(22)} ` +
      `CoC ${pct(r.headline_coc).padStart(6)} ${range.padEnd(16)} ` +
      `conf ${r.data_confidence != null ? Number(r.data_confidence).toFixed(2) : "—"}  ` +
      `byroom=${r.by_room_legal ? "Y" : r.by_room_legal === false ? "N" : "?"}  ` +
      `fin=${(r.recommended_structure ?? "—").padEnd(14)} ` +
      `owner=${r.owner_entity_type ?? "?"}${r.is_absentee ? " (abs)" : ""}${flag}`);
  }
  if (flaggedBelowCut > 0) {
    console.log(`\n  …plus ${flaggedBelowCut} more constraint-flagged deal(s) ranked below the top 12 ` +
      `(shown, not hidden — run \`npm run dossier -- --dossier <apn>\` to inspect any).`);
  }

  // 4. SCOUT — snapshot this run + diff vs the previous run ("what changed this week")
  const scout = await runScout(sql, market, { thesisVersion: thesis.version });
  console.log(`\n${scout.digest}`);

  // 5. RADAR — turn any zoning-rule change into an alpha signal (skips if no config)
  const rules = loadZoningRules(market);
  if (rules) {
    const { events } = await runRegulatoryRadar(sql, market, rules, { runId: scout.runId });
    if (events.length > 0) console.log(`\n${renderRegulatoryDigest(events)}`);
  }

  await sql.end();
  console.log(`\n✓ refresh complete.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
