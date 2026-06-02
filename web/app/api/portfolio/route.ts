import { runEngine } from "../../lib/engine";

export const dynamic = "force-dynamic";

// Portfolio Strategy Advisor (spec 018) — runs the engine's portfolio advisor and returns the
// model + money-horizon mix + best-next-buy ranking as JSON for the dashboard.
export async function GET() {
  try {
    const out = await runEngine("portfolio.ts", ["--json"]);
    return Response.json(JSON.parse(out.trim()), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
