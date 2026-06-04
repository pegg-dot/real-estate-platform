"use client";
import { useEffect, useState } from "react";

const SECTIONS = [
  { href: "/chat", icon: "💬", name: "Chat", desc: "One chat, four agents: Explainer (the plays), Operator (acts on the DB), Deal Interrogator, and Negotiation Coach." },
  { href: "/brief", icon: "🗞️", name: "Brief", desc: "Your weekly to-do list: who to mail, which deals to act on, what just opened up." },
  { href: "/map", icon: "🗺️", name: "Map", desc: "Every parcel on a map, red→green by how well it fits you. Filter by typing what you want." },
  { href: "/leads", icon: "📇", name: "Leads", desc: "Ranked list of motivated, by-the-room-legal owners to contact — and a button to draft the letter." },
  { href: "/deals", icon: "📋", name: "Pipeline", desc: "The deals you're pursuing, from watch → analyzing → offer → owned. Advance or pass each one (pick a why — it teaches LOT)." },
  { href: "/portfolio", icon: "🏢", name: "Portfolio", desc: "Your holdings + the best next-buy recommendation, sequenced to your capital and horizon." },
  { href: "/thesis", icon: "🎯", name: "Thesis", desc: "Describe what you're looking for; the whole map re-ranks to it. Switch between versions." },
  { href: "/playbook", icon: "📖", name: "Playbook", desc: "The creative-finance plays explained simply — what each is, when it fits, and what to say." },
  { href: "/changes", icon: "🛰️", name: "Changes", desc: "What moved since last week — price drops, sales, deals crossing into your shortlist." },
  { href: "/radar", icon: "🏛️", name: "Radar", desc: "Zoning changes turned into opportunity/risk — a zone that just legalized by-the-room renting." },
  { href: "/learn", icon: "🧠", name: "Learn", desc: "LOT gets sharper from your advance/pass decisions and proposes thesis tweaks for your OK." },
  { href: "/rents", icon: "🏷️", name: "Rents", desc: "Add real rent comps you know — they override the modeled rent and make scores more accurate." },
  { href: "/outreach", icon: "✉️", name: "Outreach", desc: "The mailers you've approved, with their compliance receipt." },
  { href: "/schedule", icon: "📅", name: "Schedule", desc: "Calls, follow-ups, and visits the Scheduler agent proposed and you approved — your follow-up cadence." },
  { href: "/settings", icon: "⚙️", name: "Settings & Run", desc: "Every maintenance command as a button — update data, enrich leads, connect Gmail, set your mail budget." },
];

export default function Home() {
  const [q, setQ] = useState("");
  const [autoMsg, setAutoMsg] = useState<string | null>(null);

  // Self-running automation: on every visit, ask the server to update your data if it's gone stale
  // (>1 week old). No command, nothing to remember — it just keeps itself fresh in the background.
  useEffect(() => {
    fetch("/api/automation", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
      .then((r) => r.json())
      .then((j) => { if (j.triggered) setAutoMsg(`🔄 ${j.reason}`); })
      .catch(() => {});
  }, []);

  function ask(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) { sessionStorage.setItem("lot_ask", q.trim()); window.location.href = "/chat"; }
  }
  return (
    <div className="page" style={{ maxWidth: 920 }}>
      {autoMsg && (
        <div style={{ background: "var(--positive-wash)", border: "1px solid var(--positive)", color: "var(--positive)", borderRadius: "var(--radius-md)", padding: "8px 12px", fontSize: 13, marginBottom: 14, textAlign: "center" }}>
          {autoMsg}
        </div>
      )}
      <div style={{ textAlign: "center", padding: "8px 0 22px" }}>
        <h1 style={{ font: "var(--text-display)", marginBottom: 6 }}>LOT — your buying machine</h1>
        <p className="muted" style={{ fontSize: 15, maxWidth: 600, margin: "0 auto 18px" }}>
          Find, score, and finance buy-and-hold rentals in Charlottesville. New here? Just ask it anything,
          or pick a section below — each one says what it does.
        </p>
        <form onSubmit={ask} className="composer" style={{ maxWidth: 560 }}>
          <i className="ti ti-sparkles" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder='Ask LOT anything — "what financing fits a tired landlord?"'
            style={{ fontSize: 15 }} />
          <button type="submit" className="btn-primary">Ask</button>
        </form>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 12 }}>
        {SECTIONS.map((s) => (
          <a key={s.href} href={s.href} className="card" style={{ display: "block", transition: "border-color .15s, background .15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--bg-panel-2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-soft)"; e.currentTarget.style.background = "var(--bg-panel)"; }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{s.icon} {s.name}</div>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>{s.desc}</div>
          </a>
        ))}
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 20, textAlign: "center" }}>
        New to creative financing? Start with the <a href="/playbook">Playbook</a>. Everything is informational, not legal or financial advice.
      </p>
    </div>
  );
}
