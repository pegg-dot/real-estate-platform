import { sql } from "../../lib/db";

export const dynamic = "force-dynamic";

interface Ranked { thesis_version: number; rnk: number; score: number; apn: string | null; address: string | null }

// Thesis A/B compare: how do two thesis versions rank YOUR parcels differently?
// Reads the frozen per-version scores in property_score (no re-scoring) and reports the top lists,
// the shortlist overlap, and which parcels moved in/out — the "did changing my thesis matter?" view.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const a = Number(url.searchParams.get("a"));
  const b = Number(url.searchParams.get("b"));
  if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) {
    return Response.json({ error: "pick two different thesis versions (a, b)" }, { status: 400 });
  }

  const meta = await sql()<Array<{ version: number; mode: string | null; primary: string | null }>>`
    select version, profile->'meta'->>'intake_mode' as mode, profile->'goal'->>'primary' as primary
    from thesis where version in (${a}, ${b})`;
  const metaA = meta.find((m) => m.version === a) ?? null;
  const metaB = meta.find((m) => m.version === b) ?? null;

  // top 50 of each version in one ranked pass
  const rows = await sql()<Ranked[]>`
    with ranked as (
      select thesis_version, property_id, score,
             row_number() over (partition by thesis_version order by score desc, property_id) as rnk
      from property_score where thesis_version in (${a}, ${b})
    )
    select r.thesis_version, r.rnk, r.score, p.apn, p.address
    from ranked r join property p on p.id = r.property_id
    where r.rnk <= 50
    order by r.thesis_version, r.rnk`;

  if (rows.length === 0) {
    return Response.json({ error: `no scores for version ${a} or ${b} — activate + re-score them first`, metaA, metaB }, { status: 404 });
  }

  const listA = rows.filter((r) => r.thesis_version === a);
  const listB = rows.filter((r) => r.thesis_version === b);
  const top = (l: Ranked[], n: number) => new Set(l.slice(0, n).map((r) => r.apn));
  const a25 = top(listA, 25), b25 = top(listB, 25);
  const overlap25 = [...a25].filter((x) => b25.has(x)).length;

  const rankInA = new Map(listA.map((r) => [r.apn, r.rnk]));
  const rankInB = new Map(listB.map((r) => [r.apn, r.rnk]));
  const entered = listB.filter((r) => r.rnk <= 25 && !a25.has(r.apn))
    .map((r) => ({ apn: r.apn, address: r.address, rnkB: r.rnk, rnkA: rankInA.get(r.apn) ?? null }));
  const dropped = listA.filter((r) => r.rnk <= 25 && !b25.has(r.apn))
    .map((r) => ({ apn: r.apn, address: r.address, rnkA: r.rnk, rnkB: rankInB.get(r.apn) ?? null }));

  return Response.json({
    a, b, metaA, metaB,
    topA: listA.slice(0, 15),
    topB: listB.slice(0, 15),
    overlap25,
    changed25: 25 - overlap25,
    entered,
    dropped,
  });
}
