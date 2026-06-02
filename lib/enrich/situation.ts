/**
 * Read the owner's situation (spec 014) — the "know the backstory, be there for them" layer.
 * Pure judgment over the signals LOT already holds: it infers the likely life-situation, how to
 * APPROACH the person (tone + angle), and which creative-finance play fits — so the outreach
 * solves THEIR problem instead of lowballing. Free; the LLM (Ask LOT) can elaborate on top.
 */
export interface OwnerFacts {
  entityType: string | null;     // person | llc | trust | estate | ...
  tenureYears: number | null;     // how long they've held
  isAbsentee: boolean | null;
  portfolioCount: number;         // how many parcels they own (entity resolution)
  distressCount: number;          // visible-neglect / distress signals across their parcels
  estEquityPct?: number | null;   // 0..1 (high = capital-gains exposure; low = subject-to fit)
}

export interface SituationRead {
  situation: string;              // the likely backstory
  approach: string;               // how to approach them + what they need
  bestPlay: "cash" | "seller_finance" | "subject_to";
  tone: "gentle" | "standard" | "urgent";
  signals: string[];              // the facts behind the read (auditable)
}

export function readSituation(f: OwnerFacts): SituationRead {
  const entity = (f.entityType ?? "").toLowerCase();
  const tenure = f.tenureYears ?? 0;
  const equity = f.estEquityPct ?? 0.5;
  const signals: string[] = [];

  let situation = "An owner with no strong distress signal — a softer, optional approach.";
  let approach = "A simple, no-pressure cash option: speed, certainty, you pick the date.";
  let bestPlay: SituationRead["bestPlay"] = "cash";
  let tone: SituationRead["tone"] = "standard";

  // --- portfolio seller (highest-value) ---
  if (f.portfolioCount > 1) {
    situation = `A professional / portfolio owner — holds ${f.portfolioCount} parcels.`;
    approach = "Offer to take SOME OR ALL of the portfolio; they understand terms, so lead with structure.";
    bestPlay = "seller_finance";
    signals.push(`owns ${f.portfolioCount} parcels`);
  }

  // --- estate / inherited (dignity first) ---
  if (entity === "estate" || entity === "trust") {
    situation = "Likely an INHERITED property an heir/estate doesn't want — a burden, not a business.";
    approach = "Be gentle and patient — dignity first, no pressure. Solve the burden: a clean, certain sale on their timeline.";
    bestPlay = "cash";
    tone = "gentle";
    signals.push(`entity: ${entity} (probable probate/inheritance)`);
  }

  // --- tired out-of-area landlord ---
  if (f.isAbsentee && tenure >= 15) {
    situation = "A tired, long-tenured, OUT-OF-AREA landlord — likely worn down by managing from afar.";
    approach = "Lead with “no hassle — I handle the tenants and repairs from here.” They want the headache gone.";
    bestPlay = equity >= 0.6 ? "seller_finance" : "cash";
    signals.push(`absentee + ${Math.round(tenure)}yr hold`);
  }

  // --- distress / neglect ---
  if (f.distressCount > 0) {
    situation = `Signs of distress / deferred maintenance (${f.distressCount} flag${f.distressCount > 1 ? "s" : ""}) — a checked-out or struggling owner.`;
    approach = "Solve the burden fast — stop the bleeding, take it off their hands clean.";
    tone = "urgent";
    bestPlay = equity <= 0.15 ? "subject_to" : "cash";
    signals.push(`${f.distressCount} distress signal(s)`);
  }

  // --- the financing read, refined by equity ---
  if (equity >= 0.85 && tenure >= 12) {
    bestPlay = "seller_finance";
    signals.push("high equity + long hold → capital-gains exposure (seller-finance defers it)");
  } else if (equity <= 0.15) {
    bestPlay = "subject_to";
    signals.push("thin equity → subject-to (take over the existing low-rate loan)");
  }

  if (signals.length === 0) signals.push("no strong situational signal");
  return { situation, approach, bestPlay, tone, signals };
}
