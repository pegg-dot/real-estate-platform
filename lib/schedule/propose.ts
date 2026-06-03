/**
 * Scheduler proposals (spec 025-C). Turns a scheduling request into event proposals the user
 * approves into `scheduled_event`. Deterministic relative-date parsing (works at $0 credits); `now`
 * is injected for testability. Nothing hits a calendar until the Google Calendar connector is wired.
 */
export type EventKind = "call" | "follow_up" | "visit" | "deadline" | "other";
export interface EventProposal { title: string; kind: EventKind; when: string; notes: string } // when = ISO

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const atNoonUTC = (d: Date): Date => { const x = new Date(d); x.setUTCHours(12, 0, 0, 0); return x; };
const addDays = (d: Date, n: number): Date => atNoonUTC(new Date(d.getTime() + n * 86400000));

export function parseWhen(text: string, now: Date): Date | null {
  const t = text.toLowerCase();
  if (/\btomorrow\b/.test(t)) return addDays(now, 1);
  if (/\btoday\b/.test(t)) return atNoonUTC(now);
  const days = t.match(/in\s+(\d+)\s+days?/);
  if (days) return addDays(now, Number(days[1]));
  const weeks = t.match(/in\s+(\d+)\s+weeks?/);
  if (weeks) return addDays(now, Number(weeks[1]) * 7);
  if (/\bnext week\b/.test(t)) return addDays(now, 7);
  for (let i = 0; i < 7; i++) {
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(t)) {
      let delta = (i - now.getUTCDay() + 7) % 7;
      if (delta === 0) delta = 7;             // the same weekday as today → next week's occurrence
      if (/\bnext\b/.test(t)) delta += 7;     // "next Friday" = a week past the coming Friday
      return addDays(now, delta);
    }
  }
  return null;
}

export function detectKind(text: string): EventKind {
  const t = text.toLowerCase();
  if (/\b(call|phone|ring|dial)\b/.test(t)) return "call";
  if (/\b(visit|tour|walk|drive by|see the|showing)\b/.test(t)) return "visit";
  if (/\bfollow.?up\b/.test(t)) return "follow_up";
  if (/\b(deadline|due|contingency|closing|expires?)\b/.test(t)) return "deadline";
  return "other";
}

const KIND_LABEL: Record<EventKind, string> = { call: "Call", follow_up: "Follow up", visit: "Property visit", deadline: "Deadline", other: "Reminder" };

export function proposeEvents(input: { text: string; now: Date; leadId?: string; apn?: string; label?: string }): EventProposal[] {
  const subject = input.label ?? (input.apn ? `parcel ${input.apn}` : "this lead");
  const when = parseWhen(input.text, input.now);
  if (when) {
    const kind = detectKind(input.text);
    return [{ title: `${KIND_LABEL[kind]} — ${subject}`, kind, when: when.toISOString(), notes: input.text }];
  }
  // no explicit date but an entity is attached → propose a sensible default cadence
  if (input.leadId || input.apn) {
    return [
      { title: `Call — ${subject}`, kind: "call", when: addDays(input.now, 2).toISOString(), notes: "Initial outreach call (default cadence)." },
      { title: `Follow up — ${subject}`, kind: "follow_up", when: addDays(input.now, 14).toISOString(), notes: "Follow-up if no reply (default cadence; ≤1 follow-up)." },
    ];
  }
  return [];
}
