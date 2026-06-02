/**
 * Growth-corridor computation (spec 017). Aggregates the 30-yr assessment history into ~0.5km
 * geo-grid areas, computes each area's value-trend slope + median value + corridor score (reusing
 * lib/growth/corridor.ts + the curated corridors in config/growth/<market>.json), and surfaces the
 * buy-ahead shortlist (low-priced parcels in rising corridors). Permit velocity plugs in here once
 * the permits table is backfilled — until then the score degrades gracefully (lower confidence).
 */
import type postgres from "postgres";
import type { Sql } from "./client.js";
import { corridorScore, isBuyAhead } from "../growth/corridor.js";
import corridorsCfg from "../../config/growth/charlottesville.json" with { type: "json" };

type Json = postgres.JSONValue;

const clampN = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const GRID = 0.005;                                   // ~0.5km cells
const cell = (v: number) => Math.round(v / GRID) * GRID;
const gridKey = (lat: number, lng: number) => `${cell(lat).toFixed(3)}_${cell(lng).toFixed(3)}`;

const CORRIDORS: Record<string, typeof corridorsCfg> = { Charlottesville: corridorsCfg };

function corridorProximity(market: string, lat: number, lng: number): number {
  const cfg = CORRIDORS[market];
  if (!cfg) return 0;
  for (const c of cfg.corridors) {
    if (lat >= c.minLat && lat <= c.maxLat && lng >= c.minLng && lng <= c.maxLng) return 1;
  }
  return 0;
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

interface ParcelRow { lat: number; lng: number; emv: number | null; ev: number | null; ey: number | null; lv: number | null; ly: number | null }

async function loadParcels(sql: Sql, market: string): Promise<ParcelRow[]> {
  return sql<ParcelRow[]>`
    select p.lat, p.lng, p.est_market_value::float as emv,
      -- the year-is-not-null guard matters: the denormalized current value is stored with a NULL
      -- year, and Postgres sorts NULLs FIRST on DESC, so without it the latest-year subquery returns
      -- NULL and the slope is computed off the wrong rows (it produced bogus negative appreciation).
      (select a.assessed_total::float from assessment a where a.property_id = p.id and a.assessed_total > 0 and a.year is not null order by a.year asc  limit 1) as ev,
      (select a.year       from assessment a where a.property_id = p.id and a.assessed_total > 0 and a.year is not null order by a.year asc  limit 1) as ey,
      (select a.assessed_total::float from assessment a where a.property_id = p.id and a.assessed_total > 0 and a.year is not null order by a.year desc limit 1) as lv,
      (select a.year       from assessment a where a.property_id = p.id and a.assessed_total > 0 and a.year is not null order by a.year desc limit 1) as ly
    from property p join market m on m.id = p.market_id
    where m.name = ${market} and p.lat is not null and p.lng is not null and p.is_active`;
}

/** Aggregate parcels into grid areas, score each corridor, persist to growth_area. */
export async function computeGrowthAreas(sql: Sql, market: string): Promise<{ areas: number }> {
  const rows = await loadParcels(sql, market);
  const areas = new Map<string, { lat: number; lng: number; slopes: number[]; values: number[] }>();
  for (const r of rows) {
    const key = gridKey(r.lat, r.lng);
    const a = areas.get(key) ?? { lat: cell(r.lat), lng: cell(r.lng), slopes: [], values: [] };
    if (r.emv) a.values.push(r.emv);
    // require a real baseline (≥$10k, not a land-only stub) + a ≥3-yr span, and CLAMP the CAGR to a
    // sane band — a tiny earliest assessment otherwise yields CAGR>1000, which overflows numeric(7,4)
    // and aborts the whole run. Clamp keeps it a plausible appreciation rate.
    if (r.ev && r.lv && r.ey && r.ly && (r.ly - r.ey) >= 3 && r.ev >= 10_000) {
      const cagr = Math.pow(r.lv / r.ev, 1 / (r.ly - r.ey)) - 1;
      if (Number.isFinite(cagr)) a.slopes.push(clampN(cagr, -0.5, 2));
    }
    areas.set(key, a);
  }

  const [m] = await sql<{ id: string }[]>`select id from market where name = ${market}`;
  if (!m) throw new Error(`unknown market ${market}`);
  let n = 0;
  for (const [key, a] of areas) {
    if (a.values.length < 5) continue;                 // need enough parcels for a stable median
    const slope = median(a.slopes);
    const medVal = median(a.values);
    const prox = corridorProximity(market, a.lat, a.lng);
    const cs = corridorScore({ valueTrendSlope: slope, permitVelocity: null, corridorProximity: prox, enrollmentGrowth: null, newConstructionMix: null });
    await sql`
      insert into growth_area (market_id, area_key, parcels, value_slope, median_value, corridor_score, components, confidence)
      values (${m.id}, ${key}, ${a.values.length}, ${slope}, ${medVal}, ${cs.score}, ${sql.json(cs.components as Json)}, ${cs.confidence})
      on conflict (market_id, area_key) do update set
        parcels = excluded.parcels, value_slope = excluded.value_slope, median_value = excluded.median_value,
        corridor_score = excluded.corridor_score, components = excluded.components,
        confidence = excluded.confidence, computed_at = now()`;
    n++;
  }
  return { areas: n };
}

export interface BuyAheadRow { apn: string; address: string | null; value: number; corridorScore: number; discount: number; areaMedian: number }

/** Low-priced parcels in rising corridors — the land-banking shortlist. */
export async function buyAheadShortlist(sql: Sql, market: string, limit = 25): Promise<BuyAheadRow[]> {
  const gas = await sql<{ area_key: string; corridor_score: number; median_value: number }[]>`
    select area_key, corridor_score, median_value::float as median_value from growth_area
    where market_id = (select id from market where name = ${market}) and corridor_score is not null`;
  const byArea = new Map(gas.map((g) => [g.area_key, g]));

  const parcels = await sql<{ apn: string; address: string | null; lat: number; lng: number; emv: number | null }[]>`
    select p.apn, p.address, p.lat, p.lng, p.est_market_value::float as emv
    from property p join market m on m.id = p.market_id
    where m.name = ${market} and p.lat is not null and p.lng is not null and p.is_active and p.est_market_value > 0`;

  const out: BuyAheadRow[] = [];
  for (const p of parcels) {
    const ga = byArea.get(gridKey(p.lat, p.lng));
    if (!ga) continue;
    const ba = isBuyAhead({ parcelValue: p.emv!, areaMedianValue: ga.median_value, corridorScore: ga.corridor_score });
    if (ba.flag) out.push({ apn: p.apn, address: p.address, value: p.emv!, corridorScore: ga.corridor_score, discount: ba.discount, areaMedian: ga.median_value });
  }
  return out.sort((a, b) => (b.corridorScore - a.corridorScore) || (b.discount - a.discount)).slice(0, limit);
}
