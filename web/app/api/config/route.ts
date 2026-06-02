import { sql, MARKET } from "../../lib/db";

export const dynamic = "force-dynamic";

// Read / write the sourcing config (mail budget, caps, cooldown, the global kill-switch) from the UI.
export async function GET() {
  const [c] = await sql()<Array<{ weekly_mail_budget: number; lifetime_mail_cap: number; cooldown_days: number; outreach_enabled: boolean }>>`
    select c.weekly_mail_budget, c.lifetime_mail_cap, c.cooldown_days, c.outreach_enabled
    from sourcing_config c join market m on m.id = c.market_id where m.name = ${MARKET}`;
  return Response.json(c ?? { weekly_mail_budget: 10, lifetime_mail_cap: 4, cooldown_days: 90, outreach_enabled: true });
}

export async function POST(req: Request) {
  const b = (await req.json()) as Record<string, unknown>;
  // validate + clamp to sane ranges
  const budget = Math.max(0, Math.min(500, Number(b.weekly_mail_budget) || 10));
  const cap = Math.max(1, Math.min(20, Number(b.lifetime_mail_cap) || 4));
  const cooldown = Math.max(0, Math.min(365, Number(b.cooldown_days) || 90));
  const enabled = Boolean(b.outreach_enabled);

  await sql()`
    insert into sourcing_config (market_id, weekly_mail_budget, lifetime_mail_cap, cooldown_days, outreach_enabled)
    select id, ${budget}, ${cap}, ${cooldown}, ${enabled} from market where name = ${MARKET}
    on conflict (market_id) do update set
      weekly_mail_budget = excluded.weekly_mail_budget, lifetime_mail_cap = excluded.lifetime_mail_cap,
      cooldown_days = excluded.cooldown_days, outreach_enabled = excluded.outreach_enabled`;
  return Response.json({ ok: true, weekly_mail_budget: budget, lifetime_mail_cap: cap, cooldown_days: cooldown, outreach_enabled: enabled });
}
