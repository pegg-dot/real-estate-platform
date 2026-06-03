import { runEngine } from "../../lib/engine";
import { sql } from "../../lib/db";
import { verifyPasscode } from "../../lib/passcode";

export const dynamic = "force-dynamic";

// The passcode-gated command runner (spec 027). Each command maps to a FIXED engine invocation —
// never arbitrary scripts/args. The passcode is verified server-side on every run (the real gate).
const COMMANDS: Record<string, { script: string; args: string[]; timeout: number; label: string }> = {
  refresh:   { script: "refresh-market.ts", args: ["--market", "Charlottesville", "--distress"], timeout: 600_000, label: "Update everything (county data + distress + re-score)" },
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

  try {
    const out = await runEngine(cmd.script, cmd.args, cmd.timeout);
    return Response.json({ ok: true, output: out.trim() });
  } catch (e) {
    const err = e as { stderr?: string; message?: string };
    return Response.json({ ok: false, error: String(err.stderr || err.message || e).slice(0, 4000) });
  }
}
