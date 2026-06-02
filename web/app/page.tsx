"use client";
import { useState } from "react";

const SECTIONS = [
  { href: "/ask", icon: "💬", name: "Ask LOT", desc: "Ask anything in plain English — strategies, what to say to a seller, what to do with a deal." },
  { href: "/brief", icon: "🗞️", name: "Brief", desc: "Your weekly to-do list: who to mail, which deals to act on, what just opened up." },
  { href: "/map", icon: "🗺️", name: "Map", desc: "Every parcel on a map, red→green by how well it fits you. Filter by typing what you want." },
  { href: "/leads", icon: "📇", name: "Leads", desc: "Ranked list of motivated, by-the-room-legal owners to contact — and a button to draft the letter." },
  { href: "/deals", icon: "📋", name: "Pipeline", desc: "The deals you're pursuing, from watch → analyzing → offer → owned. Advance or pass each one." },
  { href: "/thesis", icon: "🎯", name: "Thesis", desc: "Describe what you're looking for; the whole map re-ranks to it. Switch between versions." },
  { href: "/playbook", icon: "📖", name: "Playbook", desc: "The creative-finance plays explained simply — what each is, when it fits, and what to say." },
  { href: "/changes", icon: "🛰️", name: "Changes", desc: "What moved since last week — price drops, sales, deals crossing into your shortlist." },
  { href: "/radar", icon: "🏛️", name: "Radar", desc: "Zoning changes turned into opportunity/risk — a zone that just legalized by-the-room renting." },
  { href: "/learn", icon: "🧠", name: "Learn", desc: "LOT gets sharper from your advance/pass decisions and proposes thesis tweaks for your OK." },
  { href: "/rents", icon: "🏷️", name: "Rents", desc: "Add real rent comps you know — they override the modeled rent and make scores more accurate." },
  { href: "/outreach", icon: "✉️", name: "Outreach", desc: "The mailers you've approved, with their compliance receipt." },
];

export default function Home() {
  const [q, setQ] = useState("");
  function ask(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) { sessionStorage.setItem("lot_ask", q.trim()); window.location.href = "/ask"; }
  }
  return (
    <div className="page" style={{ maxWidth: 920 }}>
      <div style={{ textAlign: "center", padding: "8px 0 22px" }}>
        <h1 style={{ fontSize: 28, marginBottom: 6 }}>LOT — your buying machine</h1>
        <p className="muted" style={{ fontSize: 15, maxWidth: 600, margin: "0 auto 18px" }}>
          Find, score, and finance buy-and-hold rentals in Charlottesville. New here? Just ask it anything,
          or pick a section below — each one says what it does.
        </p>
        <form onSubmit={ask} style={{ display: "flex", gap: 8, maxWidth: 560, margin: "0 auto" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder='Ask LOT anything — "what financing fits a tired landlord?"'
            style={{ flex: 1, padding: "12px 14px", border: "1px solid #cbd5e1", borderRadius: 10, fontSize: 15 }} />
          <button type="submit" style={{ padding: "12px 22px", border: "none", background: "#0f172a", color: "#fff", borderRadius: 10, cursor: "pointer", fontSize: 15, fontWeight: 600 }}>Ask</button>
        </form>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 12 }}>
        {SECTIONS.map((s) => (
          <a key={s.href} href={s.href} style={{ display: "block", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", transition: "box-shadow .15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}>
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
