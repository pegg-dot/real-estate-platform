import { runEngine, buildAction } from "../../lib/engine";
import { sql } from "../../lib/db";

export const dynamic = "force-dynamic";

const isUuid = (s: unknown) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

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
      await sql()`insert into email_draft (lead_id, to_addr, subject, body)
        values (${isUuid(body.leadId) ? (body.leadId as string) : null}, ${str(body.to, 320) || null}, ${subject}, ${emailBody})`;
      return Response.json({ ok: true, output: "✓ saved to Drafts (see /outreach). Nothing sends until a Gmail connector is wired." });
    }
    if (body.action === "schedule-event") {
      const title = str(body.title, 300);
      if (!title) return Response.json({ ok: false, error: "event needs a title" }, { status: 400 });
      const when = typeof body.when === "string" && body.when ? new Date(body.when) : null;
      await sql()`insert into scheduled_event (title, kind, starts_at, notes, lead_id, apn)
        values (${title}, ${str(body.kind, 40) || "other"}, ${when && !isNaN(when.getTime()) ? when.toISOString() : null},
                ${str(body.notes, 4000) || null}, ${isUuid(body.leadId) ? (body.leadId as string) : null}, ${str(body.apn, 64) || null})`;
      return Response.json({ ok: true, output: "✓ added to your Schedule (see /schedule). Calendar sync lights up when the connector is wired." });
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
