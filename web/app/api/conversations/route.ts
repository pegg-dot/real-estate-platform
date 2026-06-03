import { sql } from "../../lib/db";

export const dynamic = "force-dynamic";

const AGENTS = new Set(["auto", "explainer", "operator", "interrogator", "coach"]);
const normAgent = (a: unknown): string => (typeof a === "string" && AGENTS.has(a) ? a : "explainer");

// Saved chat conversations (spec 024 Phase 2). GET = list (newest first); POST = create a new one.
export async function GET() {
  const rows = await sql()<Array<{ id: string; title: string; agent: string; updated_at: string }>>`
    select id, title, agent, to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') as updated_at
    from conversation order by updated_at desc limit 200`;
  return Response.json({ conversations: rows }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  let body: { agent?: string } = {};
  try { body = await req.json(); } catch { /* empty body ok */ }
  const agent = normAgent(body.agent);
  const [row] = await sql()<Array<{ id: string; title: string; agent: string }>>`
    insert into conversation (agent) values (${agent}) returning id, title, agent`;
  return Response.json({ conversation: row }, { headers: { "cache-control": "no-store" } });
}
