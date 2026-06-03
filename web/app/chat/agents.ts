/* Unified-chat agent registry (spec 024) — UI source of truth for the agent picker + suggestions.
   The engine half (routing/execution) lives in lib/chat/dispatch.ts; these ids are the shared
   contract. Each agent reuses a capability LOT already built. */
export interface AgentMeta {
  id: "explainer" | "operator" | "interrogator" | "coach";
  name: string;
  icon: string;        // Tabler icon suffix
  blurb: string;
  placeholder: string;
  suggestions: string[];
  contextKinds: Array<"parcel" | "lead">;   // what it can take attached (Phase 3)
}

export const AGENTS: AgentMeta[] = [
  {
    id: "explainer", name: "Explainer", icon: "book", contextKinds: [],
    blurb: "Teaches the plays, the buy-box, and the guardrails — in plain English.",
    placeholder: "Ask anything — strategies, what to say to a seller, how the app works…",
    suggestions: [
      "What's the best financing play for a tired, out-of-state landlord with lots of equity?",
      "What is subject-to, and when should I use it?",
      "What do I say to someone who just inherited a house they don't want?",
    ],
  },
  {
    id: "operator", name: "Operator", icon: "robot", contextKinds: ["parcel", "lead"],
    blurb: "Reads the whole database, runs the analyses, and proposes actions you approve.",
    placeholder: 'e.g. "show tired-landlord leads near grounds under $400k and draft a mailer for the top one"',
    suggestions: [
      "Show the top 10 by-room-legal parcels under $400k near grounds.",
      "Which owners look most motivated this week, and why?",
      "Summarize my portfolio and the best next buy.",
    ],
  },
  {
    id: "interrogator", name: "Deal Interrogator", icon: "search", contextKinds: ["parcel"],
    blurb: "Pace structures it · Grant challenges it · a synthesis verdict — for one deal.",
    placeholder: "Give me an APN (or ＋ Add a deal from the map) to interrogate…",
    suggestions: [
      "Interrogate 230014000.",
      "What's the toxic version of a subject-to on a commercial building?",
      "Why would a tired landlord agree to seller-financing?",
    ],
  },
  {
    id: "coach", name: "Negotiation Coach", icon: "target", contextKinds: ["lead"],
    blurb: "A cited call playbook + objection prep for a specific lead.",
    placeholder: "Attach a lead (＋ Add from Leads) or paste its id for the call playbook…",
    suggestions: [
      "How do I open a call with an expired-listing seller?",
      "They said 'I want my money now' — what do I say?",
      "Build the playbook for my top lead.",
    ],
  },
];

export const agentById = (id: string): AgentMeta => AGENTS.find((a) => a.id === id) ?? AGENTS[0];
