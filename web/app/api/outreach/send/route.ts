import { sql } from "../../../lib/db";
import { getGoogleAccessToken, googleConfigured } from "../../../lib/connectors";
import { currentUserId } from "../../../lib/user";
import { sendGmail } from "../../../lib/google";

export const dynamic = "force-dynamic";

// Actually send a saved email draft via the connected user's Gmail (gmail.send). Gated: needs a
// connected Gmail + a recipient. The draft body already carries the CAN-SPAM footer and the
// estate/trust manual-review routing happened at draft time — you still approve each send here.
export async function POST(req: Request) {
  let body: { id?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "bad json" }, { status: 400 }); }
  const id = body.id;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ ok: false, error: "valid draft id required" }, { status: 400 });

  if (!googleConfigured()) return Response.json({ ok: false, error: "Gmail isn't configured on this deployment yet." }, { status: 400 });

  const userId = await currentUserId();
  const token = await getGoogleAccessToken(userId).catch(() => null);
  if (!token) return Response.json({ ok: false, error: "Connect Gmail in Settings first — nothing is sent until you do." }, { status: 400 });

  const [draft] = await sql()<Array<{ to_addr: string | null; subject: string; body: string; status: string }>>`
    select to_addr, subject, body, status from email_draft where id = ${id} and user_id = ${userId}`;
  if (!draft) return Response.json({ ok: false, error: "draft not found" }, { status: 404 });
  if (draft.status === "sent") return Response.json({ ok: true, alreadySent: true, output: "Already sent." });
  if (!draft.to_addr) return Response.json({ ok: false, error: "this draft has no recipient — add an email address first" }, { status: 400 });

  try {
    const { id: gmailId } = await sendGmail(token, { to: draft.to_addr, subject: draft.subject, body: draft.body });
    await sql()`update email_draft set status = 'sent', detail = coalesce(detail, '{}'::jsonb) || ${sql().json({ gmailId, sentBy: userId })} where id = ${id} and user_id = ${userId}`;
    return Response.json({ ok: true, output: `✓ sent to ${draft.to_addr}` });
  } catch (e) {
    return Response.json({ ok: false, error: `Gmail send failed: ${(e as Error).message}` }, { status: 502 });
  }
}
