import { sql } from "../../../lib/db";
import { currentUserId } from "../../../lib/user";

export const dynamic = "force-dynamic";

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const AGENTS = new Set(["auto", "explainer", "operator", "interrogator", "coach", "outreach", "scheduler", "analyst", "roleplay"]);

// GET = a conversation's full message thread (spec 024 Phase 2). Owner-scoped: another user's
// conversation returns an empty thread, never its contents.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return Response.json({ error: "bad id" }, { status: 400 });
  const uid = await currentUserId();
  const messages = await sql()<Array<{ role: string; agent: string | null; content: string;
    context: unknown; tool_trace: unknown; proposals: unknown }>>`
    select cm.role, cm.agent, cm.content, cm.context, cm.tool_trace, cm.proposals
    from chat_message cm join conversation c on c.id = cm.conversation_id
    where cm.conversation_id = ${params.id} and c.user_id = ${uid} order by cm.created_at asc`;
  return Response.json({ messages }, { headers: { "cache-control": "no-store" } });
}

// PATCH = rename (and/or update the active agent). Owner-scoped.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return Response.json({ error: "bad id" }, { status: 400 });
  let body: { title?: string; agent?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const title = typeof body.title === "string" ? body.title.slice(0, 200) : null;
  const agent = typeof body.agent === "string" && AGENTS.has(body.agent) ? body.agent : null;
  const uid = await currentUserId();
  await sql()`
    update conversation set
      title = coalesce(${title}, title),
      agent = coalesce(${agent}, agent)
    where id = ${params.id} and user_id = ${uid}`;
  return Response.json({ ok: true });
}

// DELETE = remove a conversation (messages cascade). Owner-scoped.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return Response.json({ error: "bad id" }, { status: 400 });
  const uid = await currentUserId();
  await sql()`delete from conversation where id = ${params.id} and user_id = ${uid}`;
  return Response.json({ ok: true });
}
