import { runEngine, buildAction } from "../../lib/engine";

export const dynamic = "force-dynamic";

// One endpoint behind every UI action button. The client sends an action name + params; the
// server maps it to an allowlisted engine script (never a raw command) and returns the output.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action?: string } & Record<string, unknown>;
    if (!body.action) return Response.json({ ok: false, error: "action required" }, { status: 400 });
    const { script, args, timeout } = buildAction(body.action, body);
    const output = await runEngine(script, args, timeout);
    return Response.json({ ok: true, output: output.trim() });
  } catch (e) {
    // surface engine/LLM errors cleanly (incl. "$0 Anthropic credits") instead of a 500
    const err = e as { stderr?: string; message?: string };
    return Response.json({ ok: false, error: String(err.stderr || err.message || e).slice(0, 4000) });
  }
}
