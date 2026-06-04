import { createHash } from "node:crypto";
import { runEngine, buildAction } from "../../lib/engine";
import { sql } from "../../lib/db";
import { currentUserId } from "../../lib/user";

export const dynamic = "force-dynamic";

const isUuid = (s: unknown) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
// a stable key over a proposal's identifying parts → idempotent inserts (re-approving the same
// proposal after a reload can't create a duplicate draft/event; see migration 0028)
const dedupeKey = (parts: unknown[]) => createHash("sha256").update(parts.map((p) => String(p ?? "")).join("")).digest("hex");

// One endpoint behind every UI action button. The client sends an action name + params; the
// server maps it to an allowlisted engine script (never a raw command) and returns the output.
// A few actions are simple writes to LOT's own propose/draft tables (spec 025) — handled inline.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action?: string } & Record<string, unknown>;
    if (!body.action) return Response.json({ ok: false, error: "action required" }, { status: 400 });

    // ── spec 025 executor artifacts: propose/draft writes the web app owns (never send/sync here) ──
    if (body.action === "save-email-draft") {
      const subject = str(body.subject, 300), emailBody = str(body.body, 20000);
      if (!subject || !emailBody) return Response.json({ ok: false, error: "draft needs a subject and body" }, { status: 400 });
      const leadId = isUuid(body.leadId) ? (body.leadId as string) : null;
      const uid = await currentUserId();
      const key = dedupeKey([uid, "email", leadId, subject, emailBody]);
      const ins = await sql()`insert into email_draft (lead_id, to_addr, subject, body, dedupe_key, user_id)
        values (${leadId}, ${str(body.to, 320) || null}, ${subject}, ${emailBody}, ${key}, ${uid})
        on conflict (dedupe_key) do nothing returning id`;
      return Response.json({ ok: true, duplicate: ins.length === 0, output: ins.length === 0
        ? "Already saved to Drafts (see /outreach) — not duplicated."
        : "✓ saved to Drafts (see /outreach). Nothing sends until a Gmail connector is wired." });
    }
    if (body.action === "schedule-event") {
      const title = str(body.title, 300);
      if (!title) return Response.json({ ok: false, error: "event needs a title" }, { status: 400 });
      const when = typeof body.when === "string" && body.when ? new Date(body.when) : null;
      const whenIso = when && !isNaN(when.getTime()) ? when.toISOString() : null;
      const leadId = isUuid(body.leadId) ? (body.leadId as string) : null;
      const apn = str(body.apn, 64) || null;
      const uid = await currentUserId();
      const key = dedupeKey([uid, "event", title, whenIso, leadId, apn]);
      const ins = await sql()`insert into scheduled_event (title, kind, starts_at, notes, lead_id, apn, dedupe_key, user_id)
        values (${title}, ${str(body.kind, 40) || "other"}, ${whenIso},
                ${str(body.notes, 4000) || null}, ${leadId}, ${apn}, ${key}, ${uid})
        on conflict (dedupe_key) do nothing returning id`;
      return Response.json({ ok: true, duplicate: ins.length === 0, output: ins.length === 0
        ? "Already on your Schedule (see /schedule) — not duplicated."
        : "✓ added to your Schedule (see /schedule). Calendar sync lights up when the connector is wired." });
    }

    const { script, args, timeout } = buildAction(body.action, body);
    const output = await runEngine(script, args, timeout);
    return Response.json({ ok: true, output: output.trim() });
  } catch (e) {
    // surface engine/LLM errors cleanly (incl. "$0 Anthropic credits") instead of a 500
    const err = e as { stderr?: string; message?: string };
    return Response.json({ ok: false, error: String(err.stderr || err.message || e).slice(0, 4000) });
  }
}
