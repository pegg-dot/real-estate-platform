/**
 * Outreach compliance gate (spec 009 / Phase 4 004c) — the throw-on-violation primitive that
 * makes compliance structural, not advisory (mirrors the financing engine's assertGuardrail:
 * it returns a receipt or THROWS; it never warns-and-proceeds).
 *
 * Phase 4 is MAIL-ONLY (Nate's explicit decision): direct mail carries zero TCPA exposure.
 * SMS and calls are a single hard throw — telephony is deferred to its own spec with the
 * DNC-scrub + live-2025-one-to-one-consent + 8am-8pm-window gates. Direct mail still must
 * clear suppression/opt-out, a usable address, a lifetime contact cap, and the global
 * kill-switch. Informational, not legal advice.
 */
export type Channel = "mail" | "sms" | "call";

export interface OutreachContext {
  channel: Channel;
  ownerSuppressed: boolean;       // on the suppression / opt-out list
  mailingAddressStale: boolean;   // no usable mailing address on file
  timesMailed: number;            // lifetime mailers already sent to this owner
  lifetimeMailCap: number;        // max lifetime mailers (don't harass)
  outreachEnabled: boolean;       // global kill-switch
}

export interface ComplianceReceipt {
  channel: Channel;
  passed: true;
  checks: string[];               // the rules this send satisfied (auditable)
}

/** Returns a compliance receipt for a permitted send, or THROWS naming the rule it violates. */
export function assertCompliant(ctx: OutreachContext): ComplianceReceipt {
  // global kill-switch first — nothing leaves the system when outreach is disabled
  if (!ctx.outreachEnabled) {
    throw new Error("outreach is globally disabled (kill-switch) — no sends permitted");
  }

  // telephony is structurally unsendable in Phase 4
  if (ctx.channel === "sms" || ctx.channel === "call") {
    throw new Error(
      `channel not enabled in Phase 4: '${ctx.channel}'. Direct mail only — SMS/calls are ` +
      `deferred to their own spec (DNC-scrub + 2025 one-to-one consent + 8am-8pm window required).`);
  }

  const checks: string[] = ["channel=direct-mail (zero TCPA exposure)"];

  if (ctx.ownerSuppressed) {
    throw new Error("owner is on the suppression / opt-out list — do not mail");
  }
  checks.push("owner not suppressed / opted-out");

  if (ctx.mailingAddressStale) {
    throw new Error("no usable mailing address on file — cannot send mail");
  }
  checks.push("usable mailing address on file");

  if (ctx.timesMailed >= ctx.lifetimeMailCap) {
    throw new Error(
      `lifetime contact cap reached (${ctx.timesMailed}/${ctx.lifetimeMailCap}) — do not mail again`);
  }
  checks.push(`under lifetime contact cap (${ctx.timesMailed}/${ctx.lifetimeMailCap})`);

  return { channel: "mail", passed: true, checks };
}
