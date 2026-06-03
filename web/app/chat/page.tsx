"use client";
/* LOT — Unified chat (spec 024), Phase 1: ChatGPT/Claude-style sidebar + thread + composer with an
   agent picker + per-agent suggestions. Conversations are in-session (ephemeral) for Phase 1; Phase 2
   swaps the store for DB-backed history, Phase 3 adds the context-feed tray. All four agents route
   through /api/chat (Explainer in-process; Operator/Interrogator/Coach via the engine bridge). */
import { useState, useRef, useEffect, type ReactNode } from "react";
import { AGENTS, agentById } from "./agents";

interface Proposal { action: string; params: Record<string, unknown>; summary: string; compliance?: string[] }
interface Msg { role: "user" | "assistant"; content: string; tools?: string[]; proposals?: Proposal[] }
interface Conv { id: string; title: string; agent: string; msgs: Msg[] }

let seq = 0;
const newConv = (): Conv => ({ id: `c${Date.now()}-${seq++}`, title: "New chat", agent: "explainer", msgs: [] });

// minimal markdown: **bold** + line breaks (the Interrogator/Coach format with markdown)
function md(text: string): ReactNode {
  return text.split("\n").map((line, i) => (
    <div key={i}>{line.split("**").map((seg, j) => (j % 2 ? <strong key={j}>{seg}</strong> : seg))}{line === "" ? " " : ""}</div>
  ));
}

export default function ChatPage() {
  const [convs, setConvs] = useState<Conv[]>([newConv()]);
  const [activeId, setActiveId] = useState<string>(() => convs[0].id);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const active = convs.find((c) => c.id === activeId) ?? convs[0];
  const agent = agentById(active.agent);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [active.msgs, busy]);
  // a question typed on the Home hero (or a "use agent" handoff) lands here — send it automatically
  useEffect(() => {
    const q = sessionStorage.getItem("lot_ask");
    if (q) { sessionStorage.removeItem("lot_ask"); send(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = (id: string, fn: (c: Conv) => Conv) => setConvs((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));

  function start() { const c = newConv(); setConvs((cs) => [c, ...cs]); setActiveId(c.id); }
  function remove(id: string) {
    setConvs((cs) => {
      const next = cs.filter((c) => c.id !== id);
      const safe = next.length ? next : [newConv()];
      if (id === activeId) setActiveId(safe[0].id);
      return safe;
    });
  }
  function setAgent(id: string) { patch(active.id, (c) => ({ ...c, agent: id })); }

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const id = active.id;
    const userMsg: Msg = { role: "user", content: q };
    patch(id, (c) => ({ ...c, title: c.msgs.length === 0 ? q.slice(0, 48) : c.title, msgs: [...c.msgs, userMsg] }));
    setInput(""); setBusy(true);
    const history = [...active.msgs, userMsg].map((m) => ({ role: m.role, content: m.content }));
    const r = await fetch("/api/chat", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent: active.agent, messages: history }),
    }).then((x) => x.json()).catch((e) => ({ error: String(e) }));
    setBusy(false);
    const assistant: Msg = r.error
      ? { role: "assistant", content: `⚠️ ${r.error}` }
      : { role: "assistant", content: r.text ?? "(no reply)", tools: (r.trace ?? []).map((t: { tool: string }) => t.tool), proposals: r.proposals ?? [] };
    patch(id, (c) => ({ ...c, msgs: [...c.msgs, assistant] }));
  }

  async function approve(p: Proposal) {
    if (p.action === "send-email") { alert("Email transport isn't configured yet — the draft is ready; add an email API key to enable sending."); return; }
    const r = await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: p.action, ...p.params }) }).then((x) => x.json());
    alert(r.ok ? `✓ ${p.summary} — done` : `⚠️ ${r.error}`);
  }

  const shown = convs.filter((c) => !search || c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="chat-wrap">
      <aside className="chat-sidebar">
        <button className="btn-primary" style={{ justifyContent: "center" }} onClick={start}><i className="ti ti-plus" /> New chat</button>
        <div className="chat-search"><i className="ti ti-search" style={{ color: "var(--text-tertiary)", fontSize: 14 }} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="search chats" /></div>
        <div className="chat-group">Recent</div>
        {shown.map((c) => (
          <div key={c.id} className={`chat-conv${c.id === activeId ? " active" : ""}`} onClick={() => setActiveId(c.id)}>
            <i className={`ti ti-${agentById(c.agent).icon}`} style={{ fontSize: 13, color: "var(--accent-bright)" }} />
            <span className="title">{c.title}</span>
            <i className="ti ti-trash" onClick={(e) => { e.stopPropagation(); remove(c.id); }} title="Delete" />
          </div>
        ))}
      </aside>

      <div className="chat-main">
        <div className="console-thread">
          <div className="console-inner">
            {active.msgs.length === 0 && (
              <div>
                <div className="screen-head"><h1>{agent.name}</h1><span className="sub">{agent.blurb}</span></div>
                <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Try one of these:</p>
                <div className="suggest" style={{ flexDirection: "column", margin: 0 }}>
                  {agent.suggestions.map((s, i) => (
                    <button key={i} onClick={() => send(s)} className="chip" style={{ textAlign: "left", whiteSpace: "normal", padding: "9px 12px", cursor: "pointer" }}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {active.msgs.map((m, i) => (
              <div key={i} className={`turn ${m.role}`}>
                <div className="turn-body">
                  <div className={`bubble ${m.role}`}>{m.role === "assistant" ? md(m.content) : m.content}</div>
                  {m.tools && m.tools.length > 0 && <div className="muted mono" style={{ fontSize: 11 }}>tools: {m.tools.join(", ")}</div>}
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
            <div ref={endRef} />
          </div>
        </div>

        <div className="composer-wrap">
          <div className="agentpick">
            <span className="eyebrow">agent</span>
            <select value={active.agent} onChange={(e) => setAgent(e.target.value)}>
              {AGENTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <span className="muted" style={{ fontSize: 11 }}>{agent.blurb}</span>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="composer">
            <i className={`ti ti-${agent.icon}`} aria-hidden />
            <input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy} placeholder={agent.placeholder} />
            <button type="submit" disabled={busy} className="btn-primary">Send</button>
          </form>
          <p className="disclaimer" style={{ maxWidth: 760, margin: "8px auto 0" }}>Informational, not legal or financial advice. Agents propose — they never write or send on their own. (Model replies need Anthropic credits.)</p>
        </div>
      </div>
    </div>
  );
}
