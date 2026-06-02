"use client";
import { useState, useRef, useEffect } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "What's the best financing play for a tired, out-of-state landlord with lots of equity?",
  "What is subject-to, and when should I use it?",
  "What do I say to someone who just inherited a house they don't want?",
  "Walk me through how I'd actually do a seller-financed deal.",
  "How do I read a seller's situation before I reach out?",
];

export default function AskPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);
  // a question typed on the Home page lands here — send it automatically
  useEffect(() => {
    const q = sessionStorage.getItem("lot_ask");
    if (q) { sessionStorage.removeItem("lot_ask"); send(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next); setInput(""); setBusy(true);
    const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next }) }).then((x) => x.json());
    setBusy(false);
    setMessages([...next, { role: "assistant", content: r.ok ? r.reply : `⚠️ ${r.error}` }]);
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", height: "calc(100vh - 44px)" }}>
      <h1 style={{ fontSize: 20, marginBottom: 2 }}>Ask LOT</h1>
      <p className="muted" style={{ marginBottom: 14, fontSize: 13 }}>Ask anything — the strategies, what to say to a seller, what to do with a deal. Plain English.</p>

      <div style={{ flex: 1, overflowY: "auto", marginBottom: 12 }}>
        {messages.length === 0 && (
          <div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Try one of these:</p>
            {STARTERS.map((s, i) => (
              <button key={i} onClick={() => send(s)} style={{ display: "block", textAlign: "left", width: "100%", padding: "9px 12px", marginBottom: 6, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13 }}>{s}</button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}>
            <div style={{ maxWidth: "82%", padding: "9px 13px", borderRadius: 12, whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.5,
              background: m.role === "user" ? "#0f172a" : "#f1f5f9", color: m.role === "user" ? "#fff" : "#0f172a" }}>{m.content}</div>
          </div>
        ))}
        {busy && <div className="muted" style={{ fontSize: 13 }}>LOT is thinking…</div>}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask LOT anything…"
          style={{ flex: 1, padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }} />
        <button type="submit" disabled={busy} style={{ padding: "10px 18px", border: "none", background: "#0f172a", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>Send</button>
      </form>
      <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>Informational, not legal or financial advice. (Needs Anthropic credits to answer.)</p>
    </div>
  );
}
