/**
 * Reverse pro-forma mailer (spec 009 / Phase 4 004c).
 *
 * The "reverse pro-forma" hook: instead of a generic copy template, the letter is drafted from
 * the FINANCING engine pointed at the SELLER's situation (the seller pitch + cap-gains benefit
 * the recommend.ts engine already computes). Pure: facts in, a draft letter out — never sent
 * here (always held for Nate's one-click approval, and only after the complianceGate passes).
 *
 * Hard rule: internal reason chips (why we picked this owner) are INTERNAL ONLY and must never
 * appear in the letter. The letter stays respectful, soft, and non-promissory — informational,
 * not legal/financial advice.
 */
export interface MailerInput {
  ownerName: string | null;
  propertyAddress: string;
  sellerPitch?: string;            // financing.recommended[0].sellerPitch (the personalization)
  capGainsBenefit?: number;        // financing.recommended[0].capGains?.sellerBenefit
  structure?: string;              // recommended structure (internal context, not named at the seller)
  internalReasonChips?: string[];  // INTERNAL ONLY — deliberately ignored in the body
  signerName?: string;             // who the letter is from (default Nate)
}

export interface Mailer { subject: string; body: string }

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

export function draftMailer(m: MailerInput): Mailer {
  const greeting = m.ownerName ? `Dear ${m.ownerName},` : "Dear Owner,";
  const signer = m.signerName ?? "Nate";

  const lines: string[] = [];
  lines.push(greeting);
  lines.push("");
  lines.push(
    `I'm a local buyer interested in your property at ${m.propertyAddress}. I'm not an agent ` +
    `and there's no listing or commission involved — I buy directly and can be flexible on how a ` +
    `sale is structured to fit your goals.`);

  // the "reverse pro-forma": lead with the seller's benefit the financing engine modeled
  if (m.sellerPitch) {
    lines.push("");
    lines.push(
      `Depending on your situation, there may be options beyond a straight cash sale. ` +
      `For example: ${m.sellerPitch.replace(/\.$/, "")}` +
      (m.capGainsBenefit ? ` (an estimated ${usd(m.capGainsBenefit)} in deferred capital gains).` : "."));
  } else {
    lines.push("");
    lines.push(`I can offer a straightforward all-cash purchase with a fast, certain close and no financing contingency.`);
  }

  lines.push("");
  lines.push(
    `These figures are rough estimates for illustration — informational only, not legal or ` +
    `financial advice, and no obligation. If you'd ever consider selling, I'd welcome a conversation.`);
  lines.push("");
  lines.push(`Warm regards,`);
  lines.push(signer);

  return {
    subject: `A direct, flexible offer for ${m.propertyAddress}`,
    body: lines.join("\n"),
  };
}
