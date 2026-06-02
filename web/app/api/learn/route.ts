import { runEngine } from "../../lib/engine";

export const dynamic = "force-dynamic";

// The LEARN divergence report (reuses lib/learn via the learn CLI --json).
export async function GET() {
  try {
    const out = await runEngine("learn.ts", ["--json"], 40_000);
    const line = out.trim().split("\n").reverse().find((l) => l.trim().startsWith("{")) ?? "{}";
    return Response.json(JSON.parse(line));
  } catch (e) {
    const err = e as { stderr?: string; message?: string };
    return Response.json({ error: String(err.stderr || err.message || e).slice(0, 2000) });
  }
}
