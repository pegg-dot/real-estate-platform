import { sql } from "../../../lib/db";

export const dynamic = "force-dynamic";

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const AGENTS = new Set(["auto", "explainer", "operator", "interrogator", "coach"]);

// GET = a conversation's full message thread (spec 024 Phase 2).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return Response.json({ error: "bad id" }, { status: 400 });
  const messages = await sql()<Array<{ role: string; agent: string | null; content: string;
    context: unknown; tool_trace: unknown; proposals: unknown }>>`
    select role, agent, content, context, tool_trace, proposals
    from chat_message where conversation_id = ${params.id} order by created_at asc`;
  return Response.json({ messages }, { headers: { "cache-control": "no-store" } });
}

// PATCH = rename (and/or update the active agent).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return Response.json({ error: "bad id" }, { status: 400 });
  let body: { title?: string; agent?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const title = typeof body.title === "string" ? body.title.slice(0, 200) : null;
  const agent = typeof body.agent === "string" && AGENTS.has(body.agent) ? body.agent : null;
  await sql()`
    update conversation set
      title = coalesce(${title}, title),
      agent = coalesce(${agent}, agent)
    where id = ${params.id}`;
  return Response.json({ ok: true });
}

// DELETE = remove a conversation (messages cascade).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return Response.json({ error: "bad id" }, { status: 400 });
  await sql()`delete from conversation where id = ${params.id}`;
  return Response.json({ ok: true });
}
