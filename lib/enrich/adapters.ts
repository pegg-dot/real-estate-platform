/**
 * Owner-enrichment adapters (spec 014). The data is BOUGHT, not scraped — each adapter wraps a
 * vendor API (skip-trace, probate, court) and normalizes to OwnerIntel; it's gated on its env key
 * so the pipeline lights up the moment Nate adds an account. We do NOT scrape LinkedIn/Facebook
 * (blocked + ToS + litigated); for the human touch we hand Nate compliant research deep-links.
 *
 * Compliance: enrichment is for LOCATING an owner to make an offer — NOT a consumer report, not for
 * tenant/credit/employment eligibility (FCRA). Every dossier is stamped accordingly.
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
  mailingAddress: string | null;
  propertyAddress?: string | null;
}

/** A vendor adapter: enrich one owner, or null when its key isn't configured (skipped cleanly). */
export interface EnrichAdapter {
  name: string;
  enabled: () => boolean;
  enrich: (o: OwnerSeed) => Promise<OwnerIntel[]>;
}

// ---------------------------------------------------------------------------
// FREE, no scraping: research deep-links a human clicks to confirm the backstory.
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
// Vendor adapters (stubs + key gates) — Nate adds ONE account, this lights up.
// ---------------------------------------------------------------------------

/** Skip-trace (BatchData / Endato / REISkip): phones, emails, age, relatives, prior addresses. */
export const skipTraceAdapter: EnrichAdapter = {
  name: "skip-trace",
  enabled: () => Boolean(process.env.SKIPTRACE_API_KEY),
  async enrich(o) {
    if (!this.enabled()) return [];
    // TODO: POST owner name+mailing to the vendor; map the response to a 'contact' OwnerIntel.
    // Kept a no-op until a key + vendor are chosen (spec 014 decision #1). Never scrapes.
    void o;
    return [];
  },
};

/** Probate / death feed (vendor or obituary parse) → a 'situation' signal. */
export const probateAdapter: EnrichAdapter = {
  name: "probate",
  enabled: () => Boolean(process.env.PROBATE_API_KEY),
  async enrich() { return []; },
};

export const ADAPTERS: EnrichAdapter[] = [skipTraceAdapter, probateAdapter];
