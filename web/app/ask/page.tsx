"use client";
/* Ask LOT — restyled to the kit console (assistant/user bubbles + composer + suggestion chips).
   Visual only; all wiring (send → /api/ask, the Home-page starter via sessionStorage) preserved. */
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
    <div className="console">
      <div className="console-thread">
        <div className="console-inner">
          <div className="screen-head"><h1>Ask LOT</h1><span className="sub">the strategies, what to say to a seller, what to do with a deal — plain English.</span></div>
          {messages.length === 0 && (
            <div>
              <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Try one of these:</p>
              <div className="suggest" style={{ flexDirection: "column", margin: 0 }}>
                {STARTERS.map((s, i) => (
                  <button key={i} onClick={() => send(s)} className="chip" style={{ textAlign: "left", whiteSpace: "normal", padding: "9px 12px", cursor: "pointer" }}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`turn ${m.role}`}>
              <div className="turn-body"><div className={`bubble ${m.role}`}>{m.content}</div></div>
            </div>
          ))}
          {busy && <div className="turn assistant"><div className="turn-body"><div className="bubble assistant typing"><span /><span /><span /></div></div></div>}
          <div ref={endRef} />
        </div>
      </div>

      <div className="composer-wrap">
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="composer">
          <i className="ti ti-message-2" aria-hidden />
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask LOT anything…" />
          <button type="submit" disabled={busy} className="btn-primary">Send</button>
        </form>
        <p className="disclaimer" style={{ maxWidth: 760, margin: "8px auto 0" }}>Informational, not legal or financial advice. (Needs Anthropic credits to answer.)</p>
      </div>
    </div>
  );
}
