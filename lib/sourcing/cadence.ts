/**
 * Follow-up cadence (spec 014) — the automation that keeps a lead warm without harassing them.
 * Pure: given a lead's mail state + "now", decide the next touch (mail / wait / stop). The Brief
 * surfaces who's due; the send still passes the complianceGate + Nate's approval (mail-only).
 */
export interface CadenceState {
  status: string;                 // new | mailed | replied | dead
  timesMailed: number;
  lastMailedAt: string | null;    // ISO timestamp of the last mailer
  optedOut: boolean;
}

export interface CadenceOpts {
  stepDays?: number;              // min gap between touches (default 30)
  maxTouches?: number;            // stop after this many (default 3)
}

export interface NextAction {
  action: "mail" | "wait" | "stop";
  reason: string;
  dueInDays?: number;             // when action='wait'
}

const DAY = 86_400_000;

export function nextTouch(s: CadenceState, now: Date, opts: CadenceOpts = {}): NextAction {
  const stepDays = opts.stepDays ?? 30;
  const maxTouches = opts.maxTouches ?? 3;

  if (s.optedOut) return { action: "stop", reason: "opted out — suppressed" };
  if (s.status === "dead") return { action: "stop", reason: "lead is dead" };
  if (s.status === "replied") return { action: "stop", reason: "replied — it's a deal now (work it in the pipeline)" };
  if (s.timesMailed >= maxTouches) return { action: "stop", reason: `reached the ${maxTouches}-touch cap — don't harass` };

  if (s.timesMailed === 0 || !s.lastMailedAt) return { action: "mail", reason: "never contacted — first touch" };

  const elapsedDays = Math.floor((now.getTime() - new Date(s.lastMailedAt).getTime()) / DAY);
  if (elapsedDays >= stepDays) return { action: "mail", reason: `${elapsedDays}d since last touch — due for touch ${s.timesMailed + 1}` };
  return { action: "wait", reason: `mailed ${elapsedDays}d ago`, dueInDays: stepDays - elapsedDays };
}
