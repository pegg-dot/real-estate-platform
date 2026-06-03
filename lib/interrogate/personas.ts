/**
 * Dual-persona reasoning (spec 023, Part B) — "structure like Pace, challenge like Grant".
 *
 *  - PACE pass proposes the play (the recommended creative structure, framed around the seller's
 *    bunny + the quantified seller-win), grounded in Pace Morby's distilled heuristics.
 *  - GRANT pass adversarially reviews that proposal against the interrogation engine (questions.ts),
 *    turning the risk-bearing answers (toxic debt, due-on-sale, unanswered legality/scale) into
 *    concrete challenges with a severity.
 *  - SYNTHESIS reconciles: the recommendation that survived, with Grant's open risks SURFACED (not
 *    hidden) and a verdict that a high-severity challenge withholds.
 *
 * Deterministic (works offline). The personas are DISTILLED MODELS of the experts' publicly-stated
 * frameworks from a cited source — used to reason, clearly attributed, never the real person or fact.
 * Every output cites the persona + source. An LLM enrichment layer can sit on top later (gated).
 */
import personas from "../../config/knowledge/grant-pace-personas.json" with { type: "json" };
import { interrogateDeal, type DealFacts, type InterrogationAnswer } from "./questions.js";

const SOURCE = personas.source;
const PACE = (personas.experts as Array<{ expert: string }>).find((e) => e.expert === "Pace Morby")!;
const GRANT = (personas.experts as Array<{ expert: string }>).find((e) => e.expert === "Grant Cardone")!;
const PACE_CITE = `${PACE.expert} (persona, ${SOURCE})`;
const GRANT_CITE = `${GRANT.expert} (persona, ${SOURCE})`;

export interface PacePass {
  expert: "Pace Morby";
  structure: string;
  proposal: string;
  citations: string[];
}

export interface GrantChallenge {
  questionId: string;
  question: string;
  concern: string;
  severity: "high" | "medium" | "low";
}

export interface GrantPass {
  expert: "Grant Cardone";
  challenges: GrantChallenge[];
  citations: string[];
}

export interface Synthesis {
  verdict: "proceed" | "proceed_with_caution" | "needs_more_diligence";
  recommendation: string;
  openRisks: string[];
}

export interface DualPersonaReview {
  pace: PacePass;
  grant: GrantPass;
  synthesis: Synthesis;
  interrogation: InterrogationAnswer[];
  sources: string[];
}

function pacePass(f: DealFacts): PacePass {
  const win = f.capGainsSellerBenefit ? ` It defers ~$${f.capGainsSellerBenefit.toLocaleString()} of their cap-gains tax` : "";
  const bunny = f.bunny ? ` The bunny: ${f.bunny}` : "";
  const proposal = f.recommendedStructure === "cash"
    ? `Lead with a clean cash close for certainty and speed — there's no gain/rate lever here to justify terms, so don't overcomplicate it.${bunny}`
    : `Structure it as ${f.recommendedStructure.replace(/_/g, " ")}: keep fee title (depreciation + control), set the payment to the seller's real need, and solve their emotional bunny rather than chase the sticker price.${win ? `${win} — that's the seller-win to lead with.` : ""}${bunny}`;
  return { expert: "Pace Morby", structure: f.recommendedStructure, proposal, citations: [PACE_CITE] };
}

function grantPass(f: DealFacts, qa: InterrogationAnswer[]): GrantPass {
  const challenges: GrantChallenge[] = [];
  const find = (id: string) => qa.find((a) => a.id === id);
  const subToFamily = f.recommendedStructure === "subject_to" || f.recommendedStructure === "hybrid" || f.recommendedStructure === "wraparound";

  // toxic debt is the loudest catch — driven off FACTS (commercial-MF subject-to family), NOT
  // answer-text matching (the seller-finance guardrail literally says "balloons OK", which must not
  // read as toxic). Wraparound inherits the same underlying note as sub2, so it's in scope too.
  if (f.units >= 5 && subToFamily) {
    const theCatch = find("the_catch");
    challenges.push({ questionId: "the_catch", question: theCatch?.question ?? "What's the catch?", severity: "high",
      concern: `Toxic-debt risk: ${theCatch?.answer ?? "commercial subject-to inherits a likely balloon/adjustable note."}` });
  }

  // legality unresolved -> hard stop
  const legal = find("legality");
  if (legal?.status === "needs_data")
    challenges.push({ questionId: "legality", question: legal.question, severity: "high",
      concern: "Legality isn't established — no guardrail attached. Don't proceed until it's documented." });

  // due-on-sale only on the subject-to family (the structures that actually carry it)
  if (subToFamily) {
    const downside = find("downside_history");
    challenges.push({ questionId: "downside_history", question: downside?.question ?? "Has the downside happened?", severity: "medium",
      concern: downside?.answer ?? "Due-on-sale is the downside — rarely called (~0.1%) but the whole balance comes due if it is." });
  }

  // unfriendly market — driven off the resolved tier, not answer text
  if (f.landlordTier === "avoid" || f.landlordTier === "caution") {
    const market = find("market_diligence");
    challenges.push({ questionId: "market_diligence", question: market?.question ?? "Market diligence?",
      severity: f.landlordTier === "avoid" ? "high" : "medium",
      concern: market?.answer ?? `${f.state} landlord law is '${f.landlordTier}'.` });
  }

  // scale is unproven
  const scale = find("scale");
  if (scale?.status === "needs_data")
    challenges.push({ questionId: "scale", question: scale.question, severity: "low",
      concern: "Scale is unproven — no throughput/portfolio context. One deal isn't a system; prove the sourcing repeatability." });

  // always leave Grant with at least one first-principles challenge
  if (challenges.length === 0)
    challenges.push({ questionId: "counterparty_motive", question: find("counterparty_motive")?.question ?? "Why would they agree?",
      severity: "low", concern: "Pressure-test the counterparty's motive and the rent assumption — a clean structure still needs a real reason the seller says yes and a defensible rent." });

  return { expert: "Grant Cardone", challenges, citations: [GRANT_CITE] };
}

function synthesize(f: DealFacts, pace: PacePass, grant: GrantPass): Synthesis {
  const worst = grant.challenges.reduce<"high" | "medium" | "low">((acc, c) =>
    c.severity === "high" ? "high" : acc === "high" ? "high" : c.severity === "medium" ? "medium" : acc, "low");
  const verdict: Synthesis["verdict"] = worst === "high" ? "needs_more_diligence" : worst === "medium" ? "proceed_with_caution" : "proceed";
  const openRisks = grant.challenges.filter((c) => c.severity !== "low").map((c) => c.concern);
  const lead = verdict === "needs_more_diligence"
    ? `HOLD: Pace's ${f.recommendedStructure.replace(/_/g, " ")} play is sound in shape, but Grant raised a blocking risk — resolve it before any offer.`
    : verdict === "proceed_with_caution"
      ? `PROCEED WITH CAUTION on Pace's ${f.recommendedStructure.replace(/_/g, " ")} play — workable, with the open risks below underwritten, not ignored.`
      : `PROCEED: Pace's ${f.recommendedStructure.replace(/_/g, " ")} play survives interrogation; only routine diligence remains.`;
  return { verdict, recommendation: lead, openRisks: openRisks.length ? openRisks : grant.challenges.map((c) => c.concern) };
}

export function reviewWithPersonas(facts: DealFacts): DualPersonaReview {
  const interrogation = interrogateDeal(facts);
  const pace = pacePass(facts);
  const grant = grantPass(facts, interrogation);
  const synthesis = synthesize(facts, pace, grant);
  return { pace, grant, synthesis, interrogation, sources: [SOURCE, PACE_CITE, GRANT_CITE] };
}
