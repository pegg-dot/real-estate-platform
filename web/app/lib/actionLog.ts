/**
 * Action log writer (spec: audit/inspection). Append-only record of every mutating/outbound/engine
 * action so /activity can show what the system + agents actually did. Best-effort: a logging failure
 * must NEVER break the action it records, so every call swallows its own errors.
 */
import { sql } from "./db";
import { LEGACY_USER_ID } from "./user";

export interface LogEntry {
  action: string;                         // email.send, calendar.sync, deal.transition, engine.<cmd>, automation.tick
  actor?: "user" | "system" | "automation";
  target?: string | null;
  status?: "ok" | "error" | "blocked";
  detail?: Record<string, unknown>;
}

export async function logAction(userId: string, e: LogEntry): Promise<void> {
  try {
    await sql()`insert into action_log (user_id, actor, action, target, status, detail)
      values (${userId || LEGACY_USER_ID}, ${e.actor ?? "user"}, ${e.action}, ${e.target ?? null}, ${e.status ?? "ok"}, ${JSON.stringify(e.detail ?? {})}::jsonb)`;
  } catch { /* best-effort: never let logging break the action */ }
}
