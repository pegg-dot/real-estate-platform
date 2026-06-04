import { sql } from "../../../lib/db";
import { getGoogleAccessToken, googleConfigured } from "../../../lib/connectors";
import { currentUserId } from "../../../lib/user";
import { createCalendarEvent } from "../../../lib/google";

export const dynamic = "force-dynamic";

// Push a scheduled event to the connected user's Google Calendar (calendar.events). Owner-scoped +
// gated on a connected account. Idempotent: a row already 'synced' returns its existing event.
export async function POST(req: Request) {
  let body: { id?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "bad json" }, { status: 400 }); }
  const id = body.id;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ ok: false, error: "valid event id required" }, { status: 400 });
  if (!googleConfigured()) return Response.json({ ok: false, error: "Google Calendar isn't configured on this deployment yet." }, { status: 400 });

  const userId = await currentUserId();
  const [ev] = await sql()<Array<{ title: string; notes: string | null; starts_at: string | null; status: string }>>`
    select title, notes, starts_at, status from scheduled_event where id = ${id} and user_id = ${userId}`;
  if (!ev) return Response.json({ ok: false, error: "event not found" }, { status: 404 });
  if (ev.status === "synced") return Response.json({ ok: true, alreadySynced: true });
  if (!ev.starts_at) return Response.json({ ok: false, error: "this event has no date yet" }, { status: 400 });

  const token = await getGoogleAccessToken(userId).catch(() => null);
  if (!token) return Response.json({ ok: false, error: "Connect Google in Settings first." }, { status: 400 });

  try {
    const created = await createCalendarEvent(token, { summary: ev.title, description: ev.notes ?? undefined, startIso: ev.starts_at });
    await sql()`update scheduled_event set status = 'synced', detail = coalesce(detail, '{}'::jsonb) || ${sql().json({ gcalEventId: created.id, gcalLink: created.htmlLink })} where id = ${id}`;
    return Response.json({ ok: true, output: "added to Google Calendar", link: created.htmlLink });
  } catch (e) {
    return Response.json({ ok: false, error: `Calendar sync failed: ${(e as Error).message}` }, { status: 502 });
  }
}
