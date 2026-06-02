import { runEngine } from "../../lib/engine";

export const dynamic = "force-dynamic";

// The Monday Brief, assembled by the engine (reuses lib/brief via the brief CLI --json).
export async function GET() {
  try {
    const out = await runEngine("brief.ts", ["--json"], 60_000);
    const jsonLine = out.trim().split("\n").reverse().find((l) => l.trim().startsWith("{")) ?? "{}";
    return Response.json(JSON.parse(jsonLine));
  } catch (e) {
    const err = e as { stderr?: string; message?: string };
    return Response.json({ rows: [], summary: "", error: String(err.stderr || err.message || e).slice(0, 2000) });
  }
}
