"use client";
/* Agent console — restyled to the kit AgentConsole (bubbles + composer + proposal tool-cards).
   Visual only; all wiring (/api/agent, approve → /api/actions, the email-transport guard) preserved. */
import { useState } from "react";

interface Proposal { action: string; params: Record<string, unknown>; summary: string; compliance?: string[] }
interface Msg { role: "user" | "assistant"; content: string; tools?: string[]; proposals?: Proposal[] }

export default function AgentPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: input.trim() }];
    setMsgs(next); setInput(""); setBusy(true);
    const r = await fetch("/api/agent", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
    }).then((x) => x.json()).catch((err) => ({ error: String(err) }));
    setBusy(false);
    setMsgs([...next, r.error
      ? { role: "assistant", content: `⚠️ ${r.error}` }
      : { role: "assistant", content: r.text, tools: (r.trace ?? []).map((t: { tool: string }) => t.tool), proposals: r.proposals ?? [] }]);
  }

  async function approve(p: Proposal) {
    if (p.action === "send-email") {
      alert("Email transport isn't configured yet — the draft is ready; add an email API key to enable sending.");
      return;
    }
    const r = await fetch("/api/actions", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: p.action, ...p.params }),
    }).then((x) => x.json());
    alert(r.ok ? `✓ ${p.summary} — done` : `⚠️ ${r.error}`);
  }

  return (
    <div className="console">
      <div className="console-thread">
        <div className="console-inner">
          <div className="screen-head"><h1>Agent</h1><span className="sub">your LOT operator</span></div>
          <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>
            Ask anything in plain English. It reads the whole database, runs the analyses, and <em>proposes</em>
            actions you approve — it never writes or sends on its own. (Needs Anthropic credits to run.)
          </p>

          {msgs.map((m, i) => (
            <div key={i} className={`turn ${m.role}`}>
              <div className="turn-body">
                <div className={`bubble ${m.role}`}>{m.content}</div>
                {m.tools && m.tools.length > 0 && (
                  <div className="muted mono" style={{ fontSize: 11 }}>tools: {m.tools.join(", ")}</div>
                )}
                {m.proposals && m.proposals.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {m.proposals.map((p, j) => (
                      <div key={j} className="toolcard">
                        <div className="tc-head"><i className="ti ti-bolt" /> proposed action</div>
                        <div style={{ padding: 11 }}>
                          <div style={{ fontWeight: 600 }}>{p.summary}</div>
                          {(p.compliance ?? []).map((c, k) => <div key={k} className="muted" style={{ fontSize: 11, marginTop: 2 }}>⚖️ {c}</div>)}
                          <button onClick={() => approve(p)} className="btn-primary btn-sm" style={{ marginTop: 8 }}>Approve &amp; run</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="turn assistant"><div className="turn-body"><div className="bubble assistant typing"><span /><span /><span /></div></div></div>}
        </div>
      </div>

      <div className="composer-wrap">
        <form onSubmit={send} className="composer">
          <i className="ti ti-robot" aria-hidden />
          <input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy}
            placeholder='e.g. "show tired-landlord leads near grounds under $400k and draft a mailer for the top one"' />
          <button type="submit" disabled={busy} className="btn-primary">Send</button>
        </form>
      </div>
    </div>
  );
}
