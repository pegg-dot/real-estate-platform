import { spawn } from "node:child_process";
import path from "node:path";
import { runEngine } from "../../lib/engine";
import { sql } from "../../lib/db";
import { verifyPasscode } from "../../lib/passcode";

export const dynamic = "force-dynamic";

// The passcode-gated command runner (spec 027). Each command maps to a FIXED engine invocation —
// never arbitrary scripts/args. The passcode is verified server-side on every run (the real gate).
// `detached` commands are fire-and-forget: a full county refresh takes ~20 minutes, far past any
// request timeout, so it runs in the background (same fixed args as the stale-data automation) and
// the button returns immediately with what to expect.
const COMMANDS: Record<string, { script: string; args: string[]; timeout: number; label: string; detached?: string }> = {
  refresh:   { script: "refresh-market.ts", args: ["--market", "Charlottesville", "--distress", "--no-history", "--limit", "20000"], timeout: 0,
               detached: "Update started in the background: pulling fresh county data + distress, then re-scoring (about 20 minutes for the full city). Refresh the pages when it's done — Activity shows the run.",
               label: "Update everything (county data + distress + re-score)" },
  rescore:   { script: "refresh-market.ts", args: ["--skip-ingest", "--market", "Charlottesville"], timeout: 600_000, label: "Re-score the map" },
  enrich:    { script: "enrich.ts", args: ["--leads", "25"], timeout: 180_000, label: "Enrich the top 25 leads" },
  leads:     { script: "sourcing.ts", args: ["--generate"], timeout: 120_000, label: "Regenerate the lead list" },
  radar:     { script: "refresh-market.ts", args: ["--radar", "--market", "Charlottesville"], timeout: 60_000, label: "Run the regulatory radar" },
  growth:    { script: "growth.ts", args: [], timeout: 60_000, label: "Land-banking buy-ahead shortlist" },
  portfolio: { script: "portfolio.ts", args: [], timeout: 60_000, label: "Best next-buy recommendation" },
};

export async function POST(req: Request) {
  let b: { passcode?: string; command?: string };
  try { b = await req.json(); } catch { return Response.json({ ok: false, error: "bad json" }, { status: 400 }); }

  const cmd = COMMANDS[String(b.command ?? "")];
  if (!cmd) return Response.json({ ok: false, error: "unknown command" }, { status: 400 });

  // verify the operator's passcode (the real gate)
  const [row] = await sql()<Array<{ value: string }>>`select value from app_secret where key = 'command_passcode'`;
  if (!row?.value) return Response.json({ ok: false, error: "set a passcode first (Settings → Run commands)" }, { status: 403 });
  if (!verifyPasscode(String(b.passcode ?? ""), row.value)) return Response.json({ ok: false, error: "wrong passcode" }, { status: 401 });

  if (cmd.detached) {
    const REPO = path.resolve(process.cwd(), "..");
    const TSX = path.join(REPO, "node_modules", ".bin", "tsx");
    const child = spawn(TSX, [path.join("scripts", cmd.script), ...cmd.args], { cwd: REPO, env: process.env, detached: true, stdio: "ignore" });
    child.unref();
    return Response.json({ ok: true, output: cmd.detached });
  }
  try {
    const out = await runEngine(cmd.script, cmd.args, cmd.timeout);
    return Response.json({ ok: true, output: out.trim() });
  } catch (e) {
    const err = e as { stderr?: string; message?: string };
    return Response.json({ ok: false, error: String(err.stderr || err.message || e).slice(0, 4000) });
  }
}
