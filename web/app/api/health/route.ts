import { sql } from "../../lib/db";

export const dynamic = "force-dynamic";

// Liveness + readiness for Docker HEALTHCHECK / Render / Railway / uptime monitors. Open (no auth):
// it exposes nothing but "the database answers" and how many migrations are recorded.
export async function GET() {
  try {
    await sql()`select 1`;
    let migrations: number | null = null;
    try {
      const [m] = await sql()<Array<{ n: number }>>`select count(*)::int as n from schema_migrations`;
      migrations = m?.n ?? 0;
    } catch { migrations = null; }   // pre-tracking database: the entrypoint baselines it on next boot
    return Response.json({ ok: true, db: "ok", migrations }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ ok: false, db: "unreachable", error: String((e as Error).message).slice(0, 200) },
      { status: 503, headers: { "cache-control": "no-store" } });
  }
}
