/**
 * Call-playbook generator (spec 015 Part B) — the "deal detective" coach.
 *
 * Per lead, assembles a structured call playbook from the situation read (014), the recommended
 * creative structure (004), and cited objection exemplars distilled from the experts (016):
 * rapport -> discovery -> offer framing (NEED->sub2 / GREED->seller-finance with the quantified
 * cap-gains number) -> objection handling (cited) -> close. Pure + deterministic ASSEMBLY (no LLM):
 * it stitches shipped signals + cited exemplars into a script Nate reviews. The roleplay mode (an
 * LLM playing the seller's persona) is a separate, credit-gated layer. Nothing auto-sends; scripts
 * inherit the compliance gate (mail default). Informational, not legal/financial advice.
 */
export interface ObjectionExemplar { key: string; response: string; source: string }

export interface PlaybookInput {
  ownerName?: string | null;
  motivationType: string;
  likelyBunny: string;
  recommendedStructure: "cash" | "seller_finance" | "subject_to";
  approach: string;                       // situation.approach (the angle/tone)
  capGainsBenefit?: number | null;        // 004's quantified seller-finance benefit, if any
  objectionExemplars: ObjectionExemplar[]; // from 016 knowledge_exemplar
}

export interface PlaybookSection { title: string; lines: string[] }
export interface Playbook {
  sections: PlaybookSection[];
  citations: string[];          // distinct exemplar sources the script drew on
  confidence: "modeled";
  note: string;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function offerFraming(i: PlaybookInput): string[] {
  switch (i.recommendedStructure) {
    case "seller_finance": {
      const gain = i.capGainsBenefit != null && i.capGainsBenefit > 0
        ? ` Structured right, seller-financing can defer roughly ${usd(i.capGainsBenefit)} in capital-gains exposure versus a lump-sum sale.`
        : "";
      return [
        "Frame a SELLER-FINANCE offer: they keep monthly income instead of a taxable lump sum." + gain,
        "Position it as their headache gone but their check still coming — payments, not a payout.",
      ];
    }
    case "subject_to":
      return [
        "Frame a SUBJECT-TO offer: we take over the existing payments, nothing needed from them.",
        "⚠ Surface the due-on-sale risk (Garn-St-Germain) — tell them to have an attorney review; never present it as risk-free.",
      ];
    default:
      return [
        "Frame a CASH offer: speed and certainty — they pick the closing date, we handle everything.",
        "Lead with the problem you solve (no repairs, no showings, no agent), not the number.",
      ];
  }
}

export function buildPlaybook(i: PlaybookInput): Playbook {
  const who = i.ownerName ? ` with ${i.ownerName}` : "";
  const objections = i.objectionExemplars.slice(0, Math.max(2, i.objectionExemplars.length));

  const sections: PlaybookSection[] = [
    {
      title: "Rapport (get to the backyard)",
      lines: [
        `Open warm and low-pressure${who}. Mirror their situation: "${i.approach}"`,
        "Goal: earn enough trust that they walk you to the backyard — you're a person, not a pitch.",
      ],
    },
    {
      title: "Discovery (find the bunny)",
      lines: [
        `Likely motivation: ${i.motivationType.replace(/_/g, " ")} → bunny: ${i.likelyBunny.replace(/_/g, " ")}.`,
        "Ask: what's prompting the thought of selling? What's your timeline? What would you do next if it sold?",
        "Listen for the real reason (the bunny) before you ever talk price or structure.",
      ],
    },
    { title: "Offer framing", lines: offerFraming(i) },
    {
      title: "Objection handling (cited)",
      lines: objections.length
        ? objections.map((o) => `• ${o.key.replace(/^objection#/, "")}: "${o.response}"  [${o.source}]`)
        : ["• (no cited exemplars yet — ingest a source via spec 016 to populate)"],
    },
    {
      title: "Close / next step",
      lines: [
        "No-pressure close: confirm the next step on THEIR timeline; send the written option by mail.",
        "Never auto-send a call/text — queue for approval through the compliance gate.",
      ],
    },
  ];

  const citations = [...new Set(objections.map((o) => o.source))];
  return {
    sections,
    citations,
    confidence: "modeled",
    note: "Generated from cited exemplars + the situation read — review before anything goes out; not legal/financial advice.",
  };
}
