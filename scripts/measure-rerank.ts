#!/usr/bin/env -S tsx
/**
 * measure-rerank — quantify how much two scored theses actually re-rank the market.
 *
 * The audit's headline finding: before the appreciationProxy fix, swapping theses barely
 * moved rankings (Spearman 0.82, top-50 overlap 32/50) because appreciation_potential was a
 * market-wide constant. This measures the SAME statistics on the live property_score rows so
 * we can see whether the fix made an appreciation thesis genuinely diverge from a cash-flow one.
 *
 * Usage: tsx scripts/measure-rerank.ts <versionA> <versionB> [--market Charlottesville]
 */
import { getSql } from "../lib/db/client.js";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const next = i >= 0 ? process.argv[i + 1] : undefined;
  return next && !next.startsWith("--") ? next : fallback;
}

function spearman(a: number[], b: number[]): number {
  // a and b are already ranks (1..n) aligned by property; Pearson on ranks = Spearman.
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}

function rankMap(rows: { property_id: string; score: number }[]): Map<string, number> {
  // highest score = rank 1
  const sorted = [...rows].sort((x, y) => y.score - x.score);
  const m = new Map<string, number>();
  sorted.forEach((r, i) => m.set(r.property_id, i + 1));
  return m;
}

async function main() {
  const vA = Number(process.argv[2]);
  const vB = Number(process.argv[3]);
  if (!vA || !vB) throw new Error("usage: measure-rerank <versionA> <versionB> [--market X]");
  const market = arg("market", "Charlottesville")!;
  const dsn = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!dsn) throw new Error("SUPABASE_DB_URL not set");
  const sql = getSql(dsn);

  const fetch = (v: number) => sql<{ property_id: string; score: number }[]>`
    select ps.property_id, ps.score::float as score
    from property_score ps
    join property p on p.id = ps.property_id
    join market m on m.id = p.market_id
    where m.name = ${market} and ps.thesis_version = ${v} and ps.score is not null`;
  const [rowsA, rowsB] = await Promise.all([fetch(vA), fetch(vB)]);
  await sql.end();

  const mapB = new Map(rowsB.map((r) => [r.property_id, r.score]));
  // align on the intersection (properties scored under BOTH versions)
  const common = rowsA.filter((r) => mapB.has(r.property_id));
  const aById = new Map(common.map((r) => [r.property_id, r.score]));

  const ranksA = rankMap(common);
  const ranksB = rankMap(common.map((r) => ({ property_id: r.property_id, score: mapB.get(r.property_id)! })));

  const ids = [...ranksA.keys()];
  const rho = spearman(ids.map((id) => ranksA.get(id)!), ids.map((id) => ranksB.get(id)!));

  const topN = (m: Map<string, number>, n: number) =>
    new Set([...m.entries()].filter(([, r]) => r <= n).map(([id]) => id));
  const overlap = (n: number) => {
    const sa = topN(ranksA, n), sb = topN(ranksB, n);
    let c = 0; for (const id of sa) if (sb.has(id)) c++; return c;
  };

  // how far do individual deals move?
  const moves = ids.map((id) => Math.abs(ranksA.get(id)! - ranksB.get(id)!));
  moves.sort((x, y) => y - x);
  const medianMove = moves[Math.floor(moves.length / 2)];
  const maxMove = moves[0];

  const top50 = overlap(50);
  console.log(`\n=== Re-rank divergence: v${vA} vs v${vB} (${common.length} common properties) ===`);
  console.log(`Top-10 overlap            : ${overlap(10)}/10    (the deals Nate actually underwrites)`);
  console.log(`Top-50 overlap            : ${top50}/50   (audit pre-fix was 32/50 — LOWER = more re-ranking)`);
  console.log(`Top-100 overlap           : ${overlap(100)}/100`);
  console.log(`Median rank move          : ${medianMove} positions`);
  console.log(`Max rank move             : ${maxMove} positions`);
  console.log(`Global Spearman           : ${rho.toFixed(3)}   (NOTE: dominated by the ~${(common.length/1000).toFixed(0)}k-deep tail` +
    ` that ranks low under both theses — NOT the headline metric; two theses sharing most`);
  console.log(`                            component weights SHOULD rank the bulk alike. Judge on top-N overlap.)`);
  // The decision-relevant verdict keys on the top tier, not the global tail.
  const churn50 = 1 - top50 / 50;
  const verdict = churn50 >= 0.4 ? `✅ MEANINGFUL re-ranking — ${Math.round(churn50 * 100)}% of the top-50 deals differ between these theses`
    : churn50 >= 0.2 ? `🟨 MODERATE re-ranking — ${Math.round(churn50 * 100)}% of the top-50 differ (weight vectors may be too similar)`
    : `❌ MUTED — only ${Math.round(churn50 * 100)}% of the top-50 differ; check for a constant/shared signal`;
  console.log(`\nVerdict: ${verdict}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
