/**
 * RentCast rent-comp client (spec 013 / Phase 4+) — the LEGAL real-rent source.
 *
 * RentCast (api.rentcast.io) returns a rent AVM + real comparable listings by address (free
 * tier: ~50 req/mo). We store each comparable as a real rent_comp and the AVM as one too, so the
 * scorer can distance-weight them. Needs a free key in RENTCAST_API_KEY — the fetch is gated on
 * it (like the Anthropic key); the parse is pure + always testable. RentCast comps are
 * whole-unit (not per-room), so the by-the-room student premium still comes from manual/scraped
 * per-room comps — provenance stays honest.
 */
import type { ManualComp } from "../db/rentComps.js";

const RENTCAST_AVM = "https://api.rentcast.io/v1/avm/rent/long-term";

export interface RentCastParsed {
  avm: { rentMonthly: number; lat: number | null; lng: number | null } | null;
  comps: Array<ManualComp & { isByRoom: false; perBedRent: number }>;
}

/** Pure: parse a RentCast AVM response into an AVM + real comps (geo-less comps dropped). */
export function parseRentCastResponse(data: Record<string, unknown>, queryAddress: string): RentCastParsed {
  const rent = typeof data.rent === "number" ? data.rent : null;
  const avm = rent != null
    ? { rentMonthly: rent, lat: (data.latitude as number) ?? null, lng: (data.longitude as number) ?? null }
    : null;

  const comparables = Array.isArray(data.comparables) ? data.comparables : [];
  const comps = comparables
    .map((c) => c as Record<string, unknown>)
    .filter((c) => c.latitude != null && c.longitude != null && typeof c.price === "number")
    .map((c) => {
      const beds = typeof c.bedrooms === "number" && c.bedrooms > 0 ? c.bedrooms : 1;
      const rentMonthly = c.price as number;
      return {
        address: (c.formattedAddress as string) ?? `comp near ${queryAddress}`,
        lat: c.latitude as number, lng: c.longitude as number, beds,
        rentMonthly, perBedRent: Math.round(rentMonthly / beds), isByRoom: false as const,
      };
    });

  return { avm, comps };
}

/** Network: fetch RentCast comps for an address (needs RENTCAST_API_KEY). */
export async function fetchRentCast(
  apiKey: string, address: string, opts: { bedrooms?: number; propertyType?: string } = {},
): Promise<RentCastParsed> {
  const params = new URLSearchParams({ address });
  if (opts.bedrooms) params.set("bedrooms", String(opts.bedrooms));
  if (opts.propertyType) params.set("propertyType", opts.propertyType);
  const res = await fetch(`${RENTCAST_AVM}?${params}`, { headers: { "X-Api-Key": apiKey } });
  if (!res.ok) throw new Error(`RentCast ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  return parseRentCastResponse((await res.json()) as Record<string, unknown>, address);
}
