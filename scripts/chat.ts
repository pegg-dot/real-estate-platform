#!/usr/bin/env -S tsx
/**
 * Engine-side chat dispatcher (spec 024). Invoked by /api/chat for the tool-using agents
 * (operator / interrogator / coach) via the engine bridge:
 *   tsx scripts/chat.ts --agent operator --history <msgs.json> [--context <ctx.json>] --json
 * The explainer does NOT come here — it answers in-process in the web route.
 */
import fs from "node:fs";
import { getSql } from "../lib/db/client.js";
import { dispatchChat, type ChatAgentId, type ChatMsg, type ContextRef } from "../lib/chat/dispatch.js";

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

  // operator manages its own sql; interrogator/coach need one we open + close here
  const needsSql = agent === "interrogator" || agent === "coach";
  const sql = needsSql ? getSql() : (null as never);
  try {
    const out = await dispatchChat(sql, agent, messages, context);
    console.log(JSON.stringify(out));
  } finally {
    if (needsSql && sql) await sql.end();
  }
}

main().catch((e) => { console.error(`✗ ${(e as Error).message}`); process.exit(1); });
