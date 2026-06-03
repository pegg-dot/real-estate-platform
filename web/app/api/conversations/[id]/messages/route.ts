import { sql } from "../../../../lib/db";

export const dynamic = "force-dynamic";

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const AGENTS = new Set(["explainer", "operator", "interrogator", "coach"]);

// Append one turn to a conversation (spec 024 Phase 2). Titles the conversation from the first user
// message and bumps updated_at (via the conversation trigger) so the sidebar re-sorts.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return Response.json({ error: "bad id" }, { status: 400 });
  let b: { role?: string; agent?: string; content?: string; context?: unknown; tool_trace?: unknown; proposals?: unknown };
  try { b = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }

  const role = b.role === "assistant" ? "assistant" : "user";
  const agent = typeof b.agent === "string" && AGENTS.has(b.agent) ? b.agent : null;
  const content = String(b.content ?? "");
  const context = JSON.stringify(Array.isArray(b.context) ? b.context : []);
  const trace = JSON.stringify(Array.isArray(b.tool_trace) ? b.tool_trace : []);
  const proposals = JSON.stringify(Array.isArray(b.proposals) ? b.proposals : []);

  await sql()`
    insert into chat_message (conversation_id, role, agent, content, context, tool_trace, proposals)
    values (${params.id}, ${role}, ${agent}, ${content}, ${context}::jsonb, ${trace}::jsonb, ${proposals}::jsonb)`;

  // first user turn names the conversation; always touch agent so updated_at bumps + the sidebar re-sorts
  await sql()`
    update conversation set
      agent = coalesce(${agent}, agent),
      title = case when title = 'New chat' and ${role} = 'user' then left(${content}, 48) else title end
    where id = ${params.id}`;

  return Response.json({ ok: true });
}
