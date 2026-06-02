/**
 * Deal pipeline transition rules (spec 008 / Phase 4 004b) — the PURE core of the operating
 * spine. The legal-edge matrix + the stage-entry gates, with NO DB: transitionDeal()
 * (lib/db/deal.ts) is the only writer and consults these. Keeping them pure makes the
 * pipeline's invariants (no illegal skips; guardrail preserved at the offer boundary; the
 * regulatory kill-switch at closing) fully unit-testable.
 */

export type Stage =
  | "watch" | "analyzing" | "offer" | "under_contract" | "owned" | "passed" | "exited";

export type Action = "create" | "advance" | "pass" | "revive" | "exit";

/** The only legal stage transitions. Forward advance, pass-out from any active stage,
 * revive a passed deal, and exit a held one. No skips, no resurrection of exited deals. */
export const LEGAL_TRANSITIONS: Record<Stage, Stage[]> = {
  watch: ["analyzing", "passed"],
  analyzing: ["offer", "passed", "watch"],   // can demote back to watch
  offer: ["under_contract", "passed"],
  under_contract: ["owned", "passed"],       // a deal can still fall through
  owned: ["exited"],                          // model the long hold ending in a sale
  passed: ["watch"],                          // revive
  exited: [],                                 // terminal
};

export function isLegalTransition(from: Stage, to: Stage): boolean {
  return (LEGAL_TRANSITIONS[from] ?? []).includes(to);
}

/** Classify a transition into an action verb (for the decision log). */
export function actionFor(from: Stage, to: Stage): Action {
  if (to === "passed") return "pass";
  if (to === "exited") return "exit";
  if (from === "passed" && to === "watch") return "revive";
  if (from === "analyzing" && to === "watch") return "revive"; // demote-to-watch is a revive-ish
  return "advance";
}

export interface TransitionGateInput {
  /** by-room legality of the parcel (null = unknown -> route to verify-zoning, not analyzing) */
  byRoomLegal: boolean | null;
  /** would re-calling the financing assertGuardrail on the frozen structure throw? */
  guardrailWouldThrow: boolean;
  /** is the parcel's by-room legality STILL valid right now? (regulatory kill-switch) */
  currentLegalityOk: boolean;
}

export interface GateResult { ok: boolean; reason?: string }

/**
 * Stage-entry gate. Passing out is always allowed (you can walk away from anything). The
 * forward gates enforce the invariants:
 *  - watch→analyzing: by-room legality must be KNOWN and not false.
 *  - analyzing→offer: the financing guardrail must NOT throw (golden rule #4 — preserved as a
 *    hard refusal, never softened to a click).
 *  - offer→under_contract / under_contract→owned: legality must still hold (a zoning flip
 *    during closing freezes the deal rather than letting it close on a dead pro-forma).
 */
export function checkStageGate(from: Stage, to: Stage, g: TransitionGateInput): GateResult {
  if (to === "passed") return { ok: true };

  if (from === "watch" && to === "analyzing") {
    if (g.byRoomLegal == null) {
      return { ok: false, reason: "by-room legality unknown — route to verify-zoning before analyzing" };
    }
    if (g.byRoomLegal === false) {
      return { ok: false, reason: "by-room is not legal here — not an analyzable by-room deal" };
    }
  }

  if (to === "offer") {
    if (g.guardrailWouldThrow) {
      return { ok: false, reason: "financing guardrail would throw — refuse the offer until a compliant structure exists (golden rule #4)" };
    }
  }

  if (to === "under_contract" || to === "owned") {
    if (!g.currentLegalityOk) {
      return { ok: false, reason: "regulatory kill-switch: by-room legality flipped during closing — deal frozen, do not close on a dead pro-forma" };
    }
  }

  return { ok: true };
}
