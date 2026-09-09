/** Presentation-only helpers. No underwriting, scoring or gate logic is changed here. */
export interface ParcelFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    apn: string; address: string | null; score: number; colorValue: number;
    coc: number | null; bestUseCoc: number | null; cashFlowCoc?: number | null;
    byRoomCoc?: number | null; appreciation?: number | null;
    byRoom: boolean | null; gatePassed: boolean; structure: string | null;
    use: string | null; distress: boolean; price?: number | null; exitStrategy?: string | null;
  };
}
export interface ParcelCollection { type: "FeatureCollection"; features: ParcelFeature[] }
export type ParcelSort = "score" | "value" | "return";
export type QuickFilter = "all" | "strong" | "affordable" | "byRoom" | "distress" | "review";
export const humanize = (value: string | null | undefined) => value ? value.replace(/_/g, " ").replace(/\b\w/, letter => letter.toUpperCase()) : "Not available";
export function numberOrNull(value: unknown): number | null {
  if (value == null || value === "" || typeof value === "boolean") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
export function median(values: Array<number | null | undefined>): number | null {
  const sorted = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v)).sort((a,b) => a-b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
export function displayParcels(features: ParcelFeature[], search: string, quick: QuickFilter, sort: ParcelSort): ParcelFeature[] {
  const needle = search.trim().toLowerCase();
  const result = features.filter(({ properties: p }) => {
    if (needle && !`${p.address ?? ""} ${p.apn}`.toLowerCase().includes(needle)) return false;
    if (quick === "strong") return p.score >= 70;
    if (quick === "affordable") return p.price != null && Number.isFinite(p.price) && p.price <= 500000;
    if (quick === "byRoom") return p.byRoom === true;
    if (quick === "distress") return p.distress === true;
    if (quick === "review") return p.gatePassed === false;
    return true;
  });
  const metric = (f: ParcelFeature) => numberOrNull(sort === "value" ? f.properties.price : sort === "return" ? f.properties.bestUseCoc ?? f.properties.coc : f.properties.score);
  return result.sort((a,b) => {
    const av = metric(a), bv = metric(b);
    if (av == null && bv == null) return a.properties.apn.localeCompare(b.properties.apn);
    if (av == null) return 1;
    if (bv == null) return -1;
    return (sort === "value" ? av - bv : bv - av) || a.properties.apn.localeCompare(b.properties.apn);
  });
}
export const LENSES = [
  ["best_use", "Best-use cash-on-cash"], ["cash_flow", "Best cash flow"],
  ["appreciation", "Appreciation signal"], ["by_room", "By-room cash-on-cash"], ["score", "Thesis score"],
] as const;
export function lensLegend(lens: string) {
  if (lens === "score") return { title: "Thesis score", strong: "70 and above", moderate: "50 to 69", weak: "Below 50", unit: "Score out of 100" };
  if (lens === "appreciation") return { title: "Appreciation signal", strong: "High: 70 and above", moderate: "Medium: 50 to 69", weak: "Low: below 50", unit: "Signal index, not forecast returns" };
  return { title: "Modeled cash-on-cash", strong: "8.4% and above", moderate: "6.0% to below 8.4%", weak: "Below 6.0%", unit: "Annual return estimate, not a guarantee" };
}
