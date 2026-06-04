/**
 * Deal Interrogation engine (spec 023, Part A) — "ask like Grant".
 *
 * Runs Grant Cardone's generalized diligence question bank against a scored deal and answers each
 * from the deal's OWN data + the financing guardrails (004) + the market gate (landlord-law) +
 * macro timing (012). Pure + deterministic (works without LLM credits). The hard rule: an answer is
 * either grounded in data (with a confidence + citation) or explicitly flagged `needs_data` — it is
 * NEVER fabricated. Questions + their text come from config/knowledge/grant-pace-personas.json.
 */
import personas from "../../config/knowledge/grant-pace-personas.json" with { type: "json" };

export interface DealFacts {
  address: string;
  state: string;
  recommendedStructure: "cash" | "conventional" | "seller_finance" | "subject_to" | "hybrid" | "wraparound";
  units: number;
  estMarketValue: number;
  estGain: number | null;
  capGainsSellerBenefit: number | null;
  legalGuardrail: string | null;
  attorneyReviewRequired: boolean;
  citedRules: string[];
  sellerPitch: string | null;
  bunny: string | null;                       // the motivation / situation read (014)
  landlordTier: string | null;                // friendly | neutral | caution | avoid
  macroSignals: string[];                     // macro distress-timing detail strings (012)
  portfolioCanScale: boolean | null;          // null -> no portfolio context -> needs_data
}

export interface InterrogationAnswer {
  id: string;
  question: string;
  category: string;
  answer: string;
  confidence: "high" | "medium" | "low";
  citations: string[];
  status: "answered" | "needs_data";
}

const BANK = personas.question_bank as Array<{ id: string; category: string; text: string }>;
const SOURCE = personas.source;
const isCreative = (s: DealFacts["recommendedStructure"]): boolean =>
  s === "subject_to" || s === "seller_finance" || s === "hybrid" || s === "wraparound";

type Resolved = { answer: string; confidence: "high" | "medium" | "low"; citations: string[] } | { needsData: string };

const needs = (msg: string): Resolved => ({ needsData: msg });

function resolve(id: string, f: DealFacts): Resolved {
  const commercialMF = f.units >= 5;
  // structures that take over / wrap the seller's existing note -> inherit its (possibly toxic) terms
  const inheritsDebt = f.recommendedStructure === "subject_to" || f.recommendedStructure === "hybrid" || f.recommendedStructure === "wraparound";
  switch (id) {
    case "legality":
      if (!isCreative(f.recommendedStructure)) {
        return { answer: `${f.recommendedStructure.replace(/_/g, " ")} is a standard arm's-length purchase — no creative-finance legality question.`, confidence: "high", citations: [] };
      }
      if (f.legalGuardrail) {
        return { answer: `${f.recommendedStructure.replace(/_/g, " ")} is governed by: ${f.legalGuardrail}${f.attorneyReviewRequired ? " Attorney review is flagged." : ""}`, confidence: f.attorneyReviewRequired ? "medium" : "high", citations: f.citedRules };
      }
      return needs("no legal guardrail attached to this structure — refuse to assert legality.");

    case "ownership":
      if (f.recommendedStructure === "subject_to" || f.recommendedStructure === "hybrid" || f.recommendedStructure === "wraparound")
        return { answer: "You take the DEED (you own the property), but the seller's existing loan and the bank's lien STAY in the seller's name — you own the asset, the bank still holds the debt. That's the source of due-on-sale exposure and why the seller stays liable.", confidence: "high", citations: f.citedRules };
      if (f.recommendedStructure === "seller_finance")
        return { answer: "You take fee title (the deed) at closing; the seller carries a note + lien against the property. You own it and get depreciation; they hold paper, not title.", confidence: "high", citations: f.citedRules };
      return { answer: "Cash/conventional: you take fee title free and clear (a conventional lender holds a lien you control). Clean ownership.", confidence: "high", citations: [] };

    case "counterparty_motive":
      if (f.sellerPitch || f.bunny) {
        const win = f.capGainsSellerBenefit ? ` Quantified seller win: ~$${f.capGainsSellerBenefit.toLocaleString()} in deferred cap-gains tax.` : "";
        return { answer: `Their motive: ${f.bunny ?? "—"} The offer to them: ${f.sellerPitch ?? "—"}${win}`, confidence: f.capGainsSellerBenefit ? "medium" : "low", citations: f.citedRules };
      }
      return needs("no situation/bunny read or seller pitch on this deal — can't assert the counterparty's motive.");

    case "downside_history":
      if (f.recommendedStructure === "subject_to" || f.recommendedStructure === "hybrid" || f.recommendedStructure === "wraparound")
        return { answer: "Due-on-sale is the downside. Lenders rarely call it (~0.1% of seasoned subject-to deals per practitioner data) — but 'rare' is not 'never', and the whole balance comes due if they do. Underwrite reserves / a refinance path.", confidence: "medium", citations: ["research#due-on-sale"] };
      return { answer: "No due-on-sale exposure for this structure — the classic creative-finance downside doesn't apply.", confidence: "high", citations: [] };

    case "alternatives":
      if (isCreative(f.recommendedStructure))
        return { answer: "vs a lease-option/master-lease you take FEE TITLE → depreciation + control + the loan paydown; vs cash you preserve capital for more doors; vs a conventional loan you skip bank qualification and (sub2) keep the seller's low-rate loan. The fee-title + tax treatment is why this beats a lease structure here.", confidence: "medium", citations: f.citedRules };
      return { answer: "Cash/conventional vs creative: you trade capital efficiency for certainty + speed. Worth it when the seller needs a fast, clean close or there's no gain/rate-gap lever to justify terms.", confidence: "medium", citations: [] };

    case "scale":
      if (f.portfolioCanScale === null) return needs("no portfolio/throughput context — needs data to judge how many of these you can run.");
      return { answer: f.portfolioCanScale
        ? "Scalable: the bottleneck is SOURCING (finding motivated sellers) and transaction-coordination, not capital — the structures preserve cash. Mail volume + a TC are the levers."
        : "Not readily scalable at current throughput — sourcing or capital is the binding constraint; fix that before repeating.", confidence: "low", citations: [] };

    case "pain":
      if (commercialMF && inheritsDebt)
        return { answer: "The pain: a commercial balloon/adjustable note you inherited coming due into higher rates with no refinance on the same terms. The seller walks if you can't perform on their need. Where the money goes: into catching up arrears + reserves, not the seller's pocket.", confidence: "high", citations: f.citedRules };
      if (f.macroSignals.length)
        return { answer: `The pain / why they'd walk: ${f.macroSignals.join("; ")}. Set the payment to the seller's real need so they don't.`, confidence: "medium", citations: [] };
      return { answer: "The pain is execution: the seller walks if the offer doesn't solve their actual need, and on creative deals your money goes to reserves + the payment, not a lump sum. Lead with the bunny.", confidence: "medium", citations: [] };

    case "market_diligence":
      if (!f.landlordTier) return needs("no landlord-law tier resolved for this state — run the market gate first.");
      return { answer: `Market diligence starts with landlord law: ${f.state} is '${f.landlordTier}'. ${f.landlordTier === "avoid" ? "AVOID — tenant-favorable; eviction is slow/costly." : f.landlordTier === "caution" ? "CAUTION — trending unfriendly; watch the statute." : "Favorable footing."} Then layer migration + growth-corridor + insurance trend before committing.`, confidence: f.landlordTier === "avoid" || f.landlordTier === "caution" ? "high" : "medium", citations: [] };

    case "the_catch":
      if (commercialMF && inheritsDebt)
        return { answer: "The toxic version: commercial (5+ unit) subject-to where the underlying note is a short-term balloon or adjustable — you inherit a balloon that comes due and can't be refinanced on the same terms. Only proceed if you CONFIRM the note is fixed and long-term.", confidence: "high", citations: f.citedRules };
      if (isCreative(f.recommendedStructure) && f.legalGuardrail)
        return { answer: `The catch for this structure: ${f.legalGuardrail.split(".")[0]}. Real, but manageable with the guardrail above — not a green light.`, confidence: "medium", citations: f.citedRules };
      return { answer: "The catch here is modest — a clean cash/standard purchase. The risk is overpaying or a soft rent assumption, not the structure.", confidence: "medium", citations: [] };

    case "ten_x":
      if (f.portfolioCanScale === null) return needs("10X is a portfolio question — needs throughput + capital-deployment context to answer concretely.");
      return { answer: "10X comes from repeatable SOURCING + standardized creative structures (cash stays free), not from one bigger deal. Multiply mail volume + add transaction-coordination capacity; the structures already scale capital.", confidence: "low", citations: [] };

    default:
      return needs("no resolver for this question.");
  }
}

export function interrogateDeal(facts: DealFacts): InterrogationAnswer[] {
  return BANK.map((q) => {
    const r = resolve(q.id, facts);
    if ("needsData" in r) {
      return { id: q.id, question: q.text, category: q.category, status: "needs_data" as const,
        answer: `Needs data: ${r.needsData}`, confidence: "low" as const, citations: [] };
    }
    return { id: q.id, question: q.text, category: q.category, status: "answered" as const,
      answer: r.answer, confidence: r.confidence, citations: [...r.citations, SOURCE] };
  });
}
