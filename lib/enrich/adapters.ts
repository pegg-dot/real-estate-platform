/**
 * Owner-enrichment adapters (spec 014). The data is BOUGHT — each adapter wraps a vendor API and
 * normalizes to OwnerIntel; it's gated on its env key so the pipeline lights up the moment Nate
 * adds an account. We don't scrape social media (servers get blocked); for the human touch we hand
 * Nate compliant research deep-links. Every dossier is stamped "not a consumer report" downstream.
 */
export interface OwnerIntel {
  category: "contact" | "situation" | "demographic" | "employment" | "derived";
  detail: Record<string, unknown>;
  source: string;
  confidence: "real" | "modeled" | "estimated";
  observedAt?: string;
}

export interface OwnerSeed {
  ownerId: string;
  name: string | null;
  mailingStreet: string | null;
  mailingCity?: string | null;
  mailingState?: string | null;
  mailingZip?: string | null;
}

export interface EnrichAdapter {
  name: string;
  enabled: () => boolean;
  enrich: (o: OwnerSeed) => Promise<OwnerIntel[]>;
}

/** "LAST, FIRST MIDDLE" (county format) -> {first, last}. */
export function parseName(name: string | null): { first: string; last: string } {
  if (!name) return { first: "", last: "" };
  const clean = name.replace(/\b(TRUSTEE|LLC|TRUST|ESTATE|ET AL|JR|SR|II|III)\b/gi, "").trim();
  if (clean.includes(",")) {
    const [last, rest] = clean.split(",");
    return { first: (rest ?? "").trim().split(/\s+/)[0] ?? "", last: (last ?? "").trim() };
  }
  const parts = clean.split(/\s+/);
  return { first: parts[0] ?? "", last: parts[parts.length - 1] ?? "" };
}

// ---------------------------------------------------------------------------
// FREE, no scraping: research deep-links a human clicks.
// ---------------------------------------------------------------------------
export interface ResearchLink { label: string; url: string }

export function researchLinks(name: string, propertyAddress: string, city = "Charlottesville"): ResearchLink[] {
  const q = (s: string) => encodeURIComponent(s);
  const cleanName = (name || "").replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const links: ResearchLink[] = [
    { label: "Charlottesville GIS (parcel)", url: `https://gisweb.charlottesville.org/?address=${q(propertyAddress)}` },
    { label: "VA Circuit Court records", url: "https://eapps.courts.state.va.us/ocis/landing" },
  ];
  if (cleanName) {
    links.unshift({ label: "Web search (who they are)", url: `https://www.google.com/search?q=${q(`${cleanName} ${city} VA`)}` });
    links.push({ label: "Obituary / probate (Legacy)", url: `https://www.legacy.com/search?query=${q(cleanName)}` });
  }
  return links;
}

// ---------------------------------------------------------------------------
// Vendor adapters — real HTTP, key-gated, defensive (degrade to [] on any error).
// ---------------------------------------------------------------------------

/** BatchData skip-trace → phones + emails (category 'contact'). Set BATCHDATA_API_KEY. */
export const batchDataAdapter: EnrichAdapter = {
  name: "batchdata",
  enabled: () => Boolean(process.env.BATCHDATA_API_KEY),
  async enrich(o) {
    if (!this.enabled()) return [];
    try {
      const { first, last } = parseName(o.name);
      const res = await fetch("https://api.batchdata.com/api/v1/property/skip-trace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.BATCHDATA_API_KEY}` },
        body: JSON.stringify({ requests: [{ name: { first, last },
          propertyAddress: { street: o.mailingStreet, city: o.mailingCity ?? "Charlottesville", state: o.mailingState ?? "VA", zip: o.mailingZip } }] }),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { results?: { persons?: Array<{ phoneNumbers?: Array<{ number?: string }>; emails?: Array<{ email?: string }> }> } };
      const p = data.results?.persons?.[0];
      if (!p) return [];
      return [{ category: "contact", source: "batchdata", confidence: "real",
        detail: { phones: (p.phoneNumbers ?? []).map((x) => x.number).filter(Boolean),
                  emails: (p.emails ?? []).map((x) => x.email).filter(Boolean) } }];
    } catch { return []; }
  },
};

/** Endato / PeopleData enrichment → contact + demographics. Set ENDATO_NAME + ENDATO_KEY. */
export const endatoAdapter: EnrichAdapter = {
  name: "endato",
  enabled: () => Boolean(process.env.ENDATO_NAME && process.env.ENDATO_KEY),
  async enrich(o) {
    if (!this.enabled()) return [];
    try {
      const { first, last } = parseName(o.name);
      const res = await fetch("https://devapi.endato.com/Contact/Enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json", "galaxy-ap-name": process.env.ENDATO_NAME!, "galaxy-ap-password": process.env.ENDATO_KEY!, "galaxy-search-type": "DevAPIContactEnrich" },
        body: JSON.stringify({ FirstName: first, LastName: last, Address: { addressLine1: o.mailingStreet, addressLine2: `${o.mailingCity ?? "Charlottesville"}, ${o.mailingState ?? "VA"}` } }),
      });
      if (!res.ok) return [];
      const d = (await res.json()) as { person?: { phones?: Array<{ number?: string }>; emails?: Array<{ email?: string }>; age?: number } };
      if (!d.person) return [];
      const out: OwnerIntel[] = [{ category: "contact", source: "endato", confidence: "real",
        detail: { phones: (d.person.phones ?? []).map((x) => x.number).filter(Boolean), emails: (d.person.emails ?? []).map((x) => x.email).filter(Boolean) } }];
      if (d.person.age) out.push({ category: "demographic", source: "endato", confidence: "real", detail: { age: d.person.age } });
      return out;
    } catch { return []; }
  },
};

/** PropStream / probate — bundled-app / vendor-specific; document the seam, off until configured. */
export const propStreamAdapter: EnrichAdapter = { name: "propstream", enabled: () => false, async enrich() { return []; } };
export const probateAdapter: EnrichAdapter = { name: "probate", enabled: () => Boolean(process.env.PROBATE_API_KEY), async enrich() { return []; } };

export const ADAPTERS: EnrichAdapter[] = [batchDataAdapter, endatoAdapter, propStreamAdapter, probateAdapter];
