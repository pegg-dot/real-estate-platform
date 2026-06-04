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

  const [draft] = await sql()<Array<{ to_addr: string | null; subject: string; body: string; status: string;
    lead_id: string | null; opted_out: boolean | null; gate_state: string | null }>>`
    select d.to_addr, d.subject, d.body, d.status, d.lead_id, l.opted_out, l.gate_state
    from email_draft d left join lead l on l.id = d.lead_id
    where d.id = ${id} and d.user_id = ${userId}`;
  if (!draft) return Response.json({ ok: false, error: "draft not found" }, { status: 404 });
  if (draft.status === "sent") return Response.json({ ok: true, alreadySent: true, output: "Already sent." });
  if (!draft.to_addr) return Response.json({ ok: false, error: "this draft has no recipient — add an email address first" }, { status: 400 });

  // ── compliance gate at SEND time (not just draft time) ──────────────────────────────────────
  // Opt-out + mailability: a lead that opted out, or that the gate marked estate/probate (manual
  // review) or excluded, must not be emailed. (Drafts with no lead — manual one-offs — skip this.)
  if (draft.opted_out) return Response.json({ ok: false, error: "this owner opted out — cannot send (suppressed)." }, { status: 403 });
  if (draft.gate_state && draft.gate_state !== "mailable") {
    return Response.json({ ok: false, error: `this lead is '${draft.gate_state}', not mailable (estate/probate → manual review; institution/illegal → excluded).` }, { status: 403 });
  }
  // CAN-SPAM physical address: refuse to ship a placeholder/blank sender address.
  if (draft.body.includes("[[SET OUTREACH_SENDER_ADDRESS]]") || draft.body.includes("[your mailing address]") || !process.env.OUTREACH_SENDER_ADDRESS) {
    return Response.json({ ok: false, error: "Set OUTREACH_SENDER_ADDRESS to a real physical mailing address before sending — CAN-SPAM requires it (re-draft after setting it)." }, { status: 400 });
  }

  try {
    const { id: gmailId } = await sendGmail(token, { to: draft.to_addr, subject: draft.subject, body: draft.body });
    await sql()`update email_draft set status = 'sent', detail = coalesce(detail, '{}'::jsonb) || ${sql().json({ gmailId, sentBy: userId })} where id = ${id} and user_id = ${userId}`;
    return Response.json({ ok: true, output: `✓ sent to ${draft.to_addr}` });
  } catch (e) {
    return Response.json({ ok: false, error: `Gmail send failed: ${(e as Error).message}` }, { status: 502 });
  }
}
