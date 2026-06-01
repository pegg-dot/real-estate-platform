#!/usr/bin/env -S tsx
/**
 * Thesis CLI (spec 001) — author the thesis the engine scores against, three ways, then
 * (re)score the market and compare how different theses rank the same deals.
 *
 *   thesis --generic                                  # save + activate the default
 *   thesis --guided --priority cashflow --min-coc 0.08 --by-room --markets "Charlottesville,VA"
 *   thesis --from "all-cash student rentals near UVA, by the room, ~8% CoC"   # conversational (LLM)
 *   thesis --list
 *   thesis --activate 3
 *   thesis --rescore                                  # re-score the market under the active thesis
 *   thesis --compare 1 3 [--market Charlottesville]   # how v1 vs v3 rank the deals
 */
import { getSql, type Sql } from "../lib/db/client.js";
import { saveThesis, listTheses, setActiveThesis, getThesis, loadActiveThesis } from "../lib/db/thesis.js";
import { genericThesis, compileGuided, type GuidedAnswers } from "../lib/thesis/compile.js";
import { compileConversational, claudeExtractor } from "../lib/thesis/conversational.js";
import { scoreMarket, type Thesis } from "../lib/pipeline/scoreMarket.js";
import { type Thesis as FullThesis } from "../lib/thesis/schema.js";

const argv = process.argv;
const has = (f: string) => argv.includes(`--${f}`);
const val = (f: string, d?: string) => {
  const i = argv.indexOf(`--${f}`); const n = i >= 0 ? argv[i + 1] : undefined;
  return n && !n.startsWith("--") ? n : d;
};
const market = val("market", "Charlottesville")!;

const toScoring = (t: FullThesis): Thesis => ({
  version: t.version,
  goal: { preferred_cash_on_cash: t.goal.preferred_cash_on_cash, min_cash_on_cash: t.goal.min_cash_on_cash },
  scoring_weights: { ...t.scoring_weights },
  hard_constraints: t.hard_constraints,
});

async function announceSaved(sql: Sql, version: number, conflicts: string[]) {
  console.log(`✓ saved + activated thesis v${version}`);
  if (conflicts.length) console.log("⚠️  conflicts surfaced:\n  - " + conflicts.join("\n  - "));
  console.log(`Next: re-score with  npm run thesis -- --rescore   (or run the full refresh)`);
}

async function main() {
  const sql = getSql();
  try {
    if (has("list")) {
      const rows = await listTheses(sql);
      if (!rows.length) { console.log("(no theses yet — run --generic or --guided)"); return; }
      for (const r of rows)
        console.log(`  v${r.version}${r.is_active ? " *active*" : ""}  ${r.mode ?? "?"}  ${r.primary ?? ""}  ${r.created_at}`);
      return;
    }

    if (has("activate")) {
      const v = Number(val("activate"));
      if (!Number.isInteger(v)) throw new Error("--activate needs an integer version, e.g. --activate 3");
      await setActiveThesis(sql, v);
      console.log(`✓ activated v${v}. Re-score with --rescore.`);
      return;
    }

    if (has("rescore")) {
      const active = await loadActiveThesis(sql);
      if (!active) { console.log("no active thesis — author one first"); return; }
      const res = await scoreMarket(sql, { market, thesis: toScoring(active) });
      console.log(`✓ re-scored ${market} under thesis v${active.version}:`, res);
      return;
    }

    if (has("compare")) {
      const i = argv.indexOf("--compare");
      const [a, b] = [Number(argv[i + 1]), Number(argv[i + 2])];
      if (!Number.isInteger(a) || !Number.isInteger(b))
        throw new Error("--compare needs two integer versions, e.g. --compare 1 3");
      for (const v of [a, b]) {
        const t = await getThesis(sql, v);
        if (!t) { console.log(`thesis v${v} not found`); return; }
        await scoreMarket(sql, { market, thesis: toScoring(t) });  // ensure scored under each
      }
      const top = async (v: number) => sql<{ apn: string; address: string | null; score: number }[]>`
        select p.apn, p.address, ps.score from property_score ps
        join property p on p.id = ps.property_id join market m on m.id = p.market_id
        where m.name = ${market} and ps.thesis_version = ${v} and ps.low_confidence = false
        order by ps.score desc limit 10`;
      const [ta, tb] = [await top(a), await top(b)];
      console.log(`\nTop 10 under v${a}            |  Top 10 under v${b}`);
      for (let k = 0; k < 10; k++) {
        const l = ta[k], r = tb[k];
        const fmt = (x?: { address: string | null; apn: string; score: number }) =>
          x ? `${String(x.score).padStart(5)} ${(x.address ?? x.apn).slice(0, 22).padEnd(22)}` : " ".repeat(28);
        console.log(`  ${fmt(l)} |  ${fmt(r)}`);
      }
      return;
    }

    // --- authoring ---
    if (has("generic")) {
      const v = await saveThesis(sql, genericThesis());
      await announceSaved(sql, v, []);
    } else if (has("guided")) {
      const [mname, mstate] = (val("markets", "Charlottesville,VA")!).split(",");
      const answers: GuidedAnswers = {
        capitalPosture: val("posture", "all_cash_default")!,
        horizon: val("horizon", "long_term_hold")!,
        priority: (val("priority", "cashflow") as GuidedAnswers["priority"]),
        minCashOnCash: Number(val("min-coc", "0.08")),
        byRoomFocus: has("by-room"),
        markets: [{ name: mname!.trim(), state: (mstate ?? "VA").trim() }],
      };
      const { thesis, conflicts } = compileGuided(answers);
      const v = await saveThesis(sql, thesis);
      await announceSaved(sql, v, conflicts);
    } else if (has("from")) {
      const prose = val("from")!;
      if (!process.env.ANTHROPIC_API_KEY)
        throw new Error("conversational intake needs ANTHROPIC_API_KEY in .env");
      const { thesis, conflicts, extracted } = await compileConversational(prose, claudeExtractor());
      console.log("Here's what I heard:", JSON.stringify(extracted, null, 2));
      const v = await saveThesis(sql, thesis);
      await announceSaved(sql, v, conflicts);
    } else {
      console.log("usage: --generic | --guided ... | --from \"<prose>\" | --list | --activate N | --rescore | --compare A B");
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
