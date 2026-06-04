#!/usr/bin/env -S tsx
/**
 * Engine-side chat dispatcher (spec 024). Invoked by /api/chat for the tool-using agents
 * (operator / interrogator / coach) via the engine bridge:
 *   tsx scripts/chat.ts --agent operator --history <msgs.json> [--context <ctx.json>] --json
 * The explainer does NOT come here — it answers in-process in the web route.
 */
import fs from "node:fs";
import { getSql } from "../lib/db/client.js";
import { dispatchChat, dispatchChatStream, type ChatAgentId, type ChatMsg, type ContextRef } from "../lib/chat/dispatch.js";
import { encodeFinal, stripSentinel } from "../lib/chat/streamProtocol.js";

function readJson<T>(flag: string): T | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0 || !process.argv[i + 1]) return undefined;
  return JSON.parse(fs.readFileSync(process.argv[i + 1], "utf8")) as T;
}

async function main() {
  const ai = process.argv.indexOf("--agent");
  const agent = (ai >= 0 ? process.argv[ai + 1] : "") as ChatAgentId;
  const messages = readJson<ChatMsg[]>("--history") ?? [];
  const context = readJson<ContextRef[]>("--context") ?? [];
  if (!agent) throw new Error("usage: chat.ts --agent <id> --history <file> [--context <file>] --json");

  // open a connection for context resolution + the interrogator/coach queries (the operator's own
  // tool loop opens its own connection separately)
  const sql = getSql();
  try {
    if (process.argv.includes("--stream")) {
      // stream the visible text to stdout as it arrives, then a single trailing metadata frame
      // (␞ + JSON {trace, proposals}) the web route forwards verbatim to the client
      const tail = await dispatchChatStream(sql, agent, messages, context, (delta) => process.stdout.write(stripSentinel(delta)));
      process.stdout.write(encodeFinal(tail));
      return;
    }
    const out = await dispatchChat(sql, agent, messages, context);
    console.log(JSON.stringify(out));
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error(`✗ ${(e as Error).message}`); process.exit(1); });
