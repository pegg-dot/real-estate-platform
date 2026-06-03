import { runEngine } from "../../lib/engine";

export const dynamic = "force-dynamic";

// Deal interrogation (spec 023): run the dual-persona engine for one parcel and return
// { address, facts, review }. Deterministic — no LLM credits needed. apn is validated to a safe
// charset (must start alphanumeric, no leading '-') before it ever reaches the engine runner.
export async function GET(req: Request) {
  const apn = new URL(req.url).searchParams.get("apn");
  if (!apn || !/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(apn) || apn.length > 64)
    return Response.json({ error: "valid apn required" }, { status: 400 });
  try {
    const out = await runEngine("interrogate.ts", [apn, "--market", "Charlottesville", "--json"], 40_000);
    return Response.json(JSON.parse(out.trim()), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const raw = (e as Error).message ?? "";
    const friendly = raw.match(/✗\s*(.+)/)?.[1]?.split("\n")[0] ?? "interrogation failed";
    return Response.json({ error: friendly }, { status: 500 });
  }
}
