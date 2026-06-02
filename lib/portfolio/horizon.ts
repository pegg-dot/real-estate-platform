/**
 * Money-horizon classifier (spec 018) — the podcast's today / tomorrow / forever framing as a
 * simple, visible tag across the app. Wholesale/flip = TODAY (active income, you don't hold);
 * develop / BRRRR / a corridor land-bank = TOMORROW (equity that matures in years); buy-and-hold
 * rentals = FOREVER (durable cash-flow + appreciation — the trust-capital default). Pure.
 */
export type MoneyHorizon = "today" | "tomorrow" | "forever";

export interface HorizonInput {
  recommendedUse?: string | null;     // HBU (spec 020): hold | flip | develop | wholesale
  exitStrategy?: string | null;       // spec 019: ltr | by_room | mtr | str | section8 | assisted
  corridor?: boolean;                 // in a growth corridor (spec 017) -> land-banking
}

export function moneyHorizon(i: HorizonInput): { horizon: MoneyHorizon; reason: string } {
  const use = (i.recommendedUse ?? "").toLowerCase();
  if (use === "wholesale" || use === "flip") {
    return { horizon: "today", reason: `${use} is active income — you don't hold it` };
  }
  if (use === "develop" || i.corridor) {
    return { horizon: "tomorrow", reason: i.corridor ? "growth-corridor land-bank — equity matures in years" : "ground-up development — equity over a multi-year build" };
  }
  // everything else is a buy-and-hold rental (or unknown -> the thesis default)
  return { horizon: "forever", reason: "buy-and-hold rental — durable cash flow + appreciation" };
}
