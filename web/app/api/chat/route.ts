import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { runEngine } from "../../lib/engine";

export const dynamic = "force-dynamic";

const AGENTS = new Set(["auto", "explainer", "operator", "interrogator", "coach", "outreach", "scheduler", "analyst", "roleplay"]);

// The Explainer's grounded system prompt (shared lineage with /api/ask): teaches the plays, the
// buy-box, the guardrails, and guides Nate around the app. Answered IN-PROCESS (fast Haiku).
const EXPLAINER_SYSTEM = `You are LOT's in-app assistant for Nate, who is learning to buy buy-and-hold
rentals (first market: Charlottesville / UVA student rentals, by-the-room model; all-cash via a family
trust; long horizon). Answer in PLAIN ENGLISH, friendly and concrete, like a sharp mentor. Keep answers
short unless he asks for depth. ALWAYS surface the legal guardrail on creative-finance topics and say
"this is informational, not legal advice — involve an attorney." Never present creative finance as risk-free.

The plays you can explain: BIRD-DOGGING (hand a lead to an investor for a fee; no capital). WHOLESALING
(contract cheap, assign for a fee; never own it). CASH (your funds; fast, certain; ties up capital).
SELLER FINANCING (the seller becomes the bank; best for free-and-clear owners wanting income or to defer
capital gains; guardrail: Dodd-Frank/SAFE if the seller is a consumer-occupant). SUBJECT-TO (take the
deed, keep paying their existing low-rate loan; best for low-equity/distressed; guardrail: due-on-sale,
Garn-St-Germain trust caveat, always an attorney). HYBRID (a mix).

Reading the seller: long-tenure+absentee = tired landlord (income pitch); estate/trust = inherited, be
gentle; visible neglect = distress; high-equity+long-hold = capital-gains pitch (seller-finance);
low-equity/behind = subject-to. Lead with empathy; direct mail first.

Guiding around LOT: the MAP shows ~12k scored parcels (click one for the deal panel + financing + the
seller pitch; there's an "Interrogate this deal" button); the BRIEF is the weekly to-do list; LEADS are
ranked motivated owners; the PIPELINE tracks deals; THESIS lets him describe what he wants in prose; the
PLAYBOOK explains these plays. To filter the map, tell him to type what he wants in the Map's search bar.
In this chat he can also switch to the Operator (acts on the database), the Deal Interrogator (Pace
structures / Grant challenges a deal), or the Coach (a call playbook for a lead).`;

function creditsError(raw: string): string {
  return /credit balance|insufficient.*credit|quota|billing/i.test(raw)
    ? "This needs Anthropic credits to answer — add billing to enable it. (The chat, agents, and history all work; only the model replies need credits.)"
    : /ANTHROPIC_API_KEY/i.test(raw)
      ? "ANTHROPIC_API_KEY isn't set — add it to .env."
      : (raw.match(/✗\s*(.+)/)?.[1]?.split("\n")[0] ?? raw.slice(0, 300));
}

export async function POST(req: Request) {
  let body: { agent?: string; messages?: Array<{ role?: string; content?: string }>; context?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  const agent = String(body.agent ?? "explainer");
  if (!AGENTS.has(agent)) return Response.json({ error: "unknown agent" }, { status: 400 });
  const msgs = body.messages;
  if (!Array.isArray(msgs) || msgs.length === 0) return Response.json({ error: "no messages" }, { status: 400 });
  const safe: Array<{ role: "user" | "assistant"; content: string }> = msgs.slice(-16).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content ?? "").slice(0, 8000),
  }));

  // ---- Explainer: in-process (fast Haiku), no tools ----
  if (agent === "explainer") {
    if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: creditsError("ANTHROPIC_API_KEY") }, { status: 500 });
    try {
      const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const { text } = await generateText({
        model: anthropic("claude-haiku-4-5-20251001"),
        system: EXPLAINER_SYSTEM, messages: safe, maxTokens: 800,
      });
      return Response.json({ text, trace: [], proposals: [] }, { headers: { "cache-control": "no-store" } });
    } catch (e) {
      return Response.json({ error: creditsError((e as Error).message ?? "") }, { status: 500 });
    }
  }

  // ---- Operator / Interrogator / Coach: engine bridge (tools need root /lib + DB) ----
  const histFile = path.join(os.tmpdir(), `lot-chat-${randomUUID()}.json`);
  const ctxFile = path.join(os.tmpdir(), `lot-chatctx-${randomUUID()}.json`);
  try {
    fs.writeFileSync(histFile, JSON.stringify(safe));
    fs.writeFileSync(ctxFile, JSON.stringify(Array.isArray(body.context) ? body.context : []));
    const out = await runEngine("chat.ts", ["--agent", agent, "--history", histFile, "--context", ctxFile, "--json"], 180_000);
    return Response.json(JSON.parse(out.trim()), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: creditsError((e as Error).message ?? "") }, { status: 500 });
  } finally {
    try { fs.unlinkSync(histFile); } catch { /* best-effort */ }
    try { fs.unlinkSync(ctxFile); } catch { /* best-effort */ }
  }
}
