import { sql, MARKET } from "../../lib/db";

export const dynamic = "force-dynamic";

// Owner intelligence — the free win: resolve the whole PERSON behind a parcel from our own data
// (their full portfolio), plus any bought enrichment (owner_intel) + compliant research links.
export async function GET(req: Request) {
  const apn = new URL(req.url).searchParams.get("apn");
  if (!apn) return Response.json({ error: "apn required" }, { status: 400 });

  const [owner] = await sql()<Array<{ id: string; name: string | null; entity_type: string | null;
    is_absentee: boolean | null; tenure_years: string | null; mailing_address: string | null }>>`
    select o.id, o.name, o.entity_type, o.is_absentee, o.tenure_years, o.mailing_address
    from property p join owner o on o.id = p.owner_id join market m on m.id = p.market_id
    where m.name = ${MARKET} and p.apn = ${apn} limit 1`;
  if (!owner) return Response.json({ error: "no owner" }, { status: 404 });

  // PORTFOLIO: every parcel this owner holds — turns a single lead into a portfolio-seller picture
  const parcels = await sql()<Array<{ apn: string; address: string | null; est_market_value: string | null;
    by_room_legal: boolean | null; score: string | null; distress: boolean }>>`
    select p.apn, p.address, p.est_market_value, p.by_room_legal,
           dg.score, exists(select 1 from distress_signal ds where ds.property_id = p.id) as distress
    from property p
    join market m on m.id = p.market_id
    left join deal_genome dg on dg.apn = p.apn and dg.market = ${MARKET}
    where p.owner_id = ${owner.id}
    order by p.est_market_value desc nulls last limit 100`;

  const num = (s: string | null) => (s == null ? 0 : Number(s));
  const totalValue = parcels.reduce((a, p) => a + num(p.est_market_value), 0);
  const portfolio = {
    count: parcels.length,
    totalValue,
    byRoomLegal: parcels.filter((p) => p.by_room_legal === true).length,
    distressCount: parcels.filter((p) => p.distress).length,
    parcels: parcels.slice(0, 25),
  };

  const intel = await sql()<Array<{ category: string; detail: Record<string, unknown>; source: string; confidence: string }>>`
    select category, detail, source, confidence from owner_intel where owner_id = ${owner.id}`;
  const situation = intel.find((x) => x.category === "situation")?.detail ?? null;
  const contact = intel.find((x) => x.category === "contact")?.detail ?? null;

  // compliant research deep-links (no scraping — a human clicks these)
  const q = (s: string) => encodeURIComponent(s);
  const cleanName = (owner.name || "").replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const links = [
    ...(cleanName ? [{ label: "Web search (who they are)", url: `https://www.google.com/search?q=${q(cleanName + " Charlottesville VA")}` }] : []),
    { label: "Charlottesville GIS", url: `https://gisweb.charlottesville.org/` },
    { label: "VA Circuit Court records", url: "https://eapps.courts.state.va.us/ocis/landing" },
    ...(cleanName ? [{ label: "Obituary / probate (Legacy)", url: `https://www.legacy.com/search?query=${q(cleanName)}` }] : []),
  ];

  return Response.json({ owner, portfolio, intel, situation, contact, links }, { headers: { "cache-control": "no-store" } });
}
