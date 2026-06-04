import { spawn } from "node:child_process";
import path from "node:path";
import { sql, MARKET } from "../../lib/db";
import { logAction } from "../../lib/actionLog";
import { LEGACY_USER_ID } from "../../lib/user";

export const dynamic = "force-dynamic";

async function getSetting(key: string): Promise<Record<string, unknown>> {
  const [r] = await sql()<Array<{ value: Record<string, unknown> }>>`select value from app_setting where key = ${key}`;
  return r?.value ?? {};
}
type JsonObj = Record<string, string | number | boolean | null>;
async function setSetting(key: string, value: JsonObj) {
  await sql()`insert into app_setting (key, value, updated_at) values (${key}, ${sql().json(value)}, now())
              on conflict (key) do update set value = excluded.value, updated_at = now()`;
}
async function lastRefreshAgeDays(): Promise<number | null> {
  const [run] = await sql()<Array<{ started_at: string }>>`
    select rr.started_at from refresh_run rr join market m on m.id = rr.market_id
    where m.name = ${MARKET} order by rr.started_at desc limit 1`;
  return run ? (Date.now() - new Date(run.started_at).getTime()) / 86_400_000 : null;
}

export async function GET() {
  const auto = await getSetting("auto_refresh");
  const age = await lastRefreshAgeDays();
  return Response.json({ autoEnabled: auto.enabled !== false, lastRefreshAgeDays: age, isDue: age == null || age >= 7 });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { action?: string; enabled?: boolean };

  if (body.action === "toggle") {
    await setSetting("auto_refresh", { enabled: Boolean(body.enabled) });
    return Response.json({ ok: true, enabled: Boolean(body.enabled) });
  }

  // tick (fired on app load): refresh only if ON + data is stale + we didn't just trigger one
  const auto = await getSetting("auto_refresh");
  if (auto.enabled === false) return Response.json({ triggered: false, reason: "auto-refresh is off" });

  const lastTrig = await getSetting("last_auto_refresh");
  const trigAgeH = lastTrig.at ? (Date.now() - new Date(String(lastTrig.at)).getTime()) / 3_600_000 : Infinity;
  if (trigAgeH < 6) return Response.json({ triggered: false, reason: "an update already ran recently" });

  const age = await lastRefreshAgeDays();
  if (age != null && age < 7) return Response.json({ triggered: false, reason: "data is fresh" });

  const REPO = path.resolve(process.cwd(), "..");
  const TSX = path.join(REPO, "node_modules", ".bin", "tsx");
  const child = spawn(TSX, ["scripts/refresh-market.ts", "--market", "Charlottesville", "--distress", "--no-history", "--limit", "20000"],
    { cwd: REPO, env: process.env, detached: true, stdio: "ignore" });
  child.unref();
  await setSetting("last_auto_refresh", { at: new Date().toISOString() });
  await logAction(LEGACY_USER_ID, { action: "automation.tick", actor: "automation", status: "ok", detail: { reason: "stale data auto-refresh", ageDays: age == null ? null : Math.round(age) } });
  return Response.json({ triggered: true, reason: `your data was ~${age == null ? "never" : Math.round(age) + "d"} old — auto-updating in the background now` });
}
