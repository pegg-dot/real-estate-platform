import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { runEngine } from "../../lib/engine";

export const dynamic = "force-dynamic";

// Operator agent (spec 022): runs the engine's agent loop over the conversation and returns
// { text, trace, proposals }. The user messages go into a temp file (NOT argv), so there's no
// flag-smuggling; the agent only READS the DB and PROPOSES actions (the user approves separately).
export async function POST(req: Request) {
  let body: { messages?: Array<{ role?: string; content?: string }> };
  try { body = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  const msgs = body.messages;
  if (!Array.isArray(msgs) || msgs.length === 0) return Response.json({ error: "no messages" }, { status: 400 });

  const safe = msgs.slice(-16).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content ?? "").slice(0, 8000),
  }));
  const file = path.join(os.tmpdir(), `lot-agent-${randomUUID()}.json`);
  try {
    fs.writeFileSync(file, JSON.stringify(safe));
    const out = await runEngine("agent.ts", ["--history", file, "--json"], 180_000);
    return Response.json(JSON.parse(out.trim()), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    // surface a clean reason instead of the raw "Command failed: tsx …" wrapper
    const raw = (e as Error).message ?? "";
    const friendly = /credit balance|insufficient.*credit|quota|billing/i.test(raw)
      ? "The agent needs Anthropic credits to run — add billing to enable it."
      : /ANTHROPIC_API_KEY/i.test(raw)
        ? "ANTHROPIC_API_KEY isn't set — add it to .env."
        : (raw.match(/✗\s*(.+)/)?.[1]?.split("\n")[0] ?? raw.slice(0, 300));
    return Response.json({ error: friendly }, { status: 500 });
  } finally {
    try { fs.unlinkSync(file); } catch { /* best-effort cleanup */ }
  }
}
