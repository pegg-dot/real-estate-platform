"use client";
/* LOT — Unified chat (spec 024). ChatGPT/Claude-style sidebar + thread + composer with an agent
   picker + per-agent suggestions. Phase 2: DB-backed history — conversations + messages persist
   (draft-until-first-message, like ChatGPT). Phase 3 adds the context-feed tray. All four agents
   route through /api/chat (Explainer in-process; Operator/Interrogator/Coach via the engine bridge). */
import { useState, useRef, useEffect, type ReactNode } from "react";
import { AGENTS, agentById } from "./agents";
import { getContext, removeContext, subscribeContext, type CtxEntity } from "./contextStore";

interface Proposal { action: string; params: Record<string, unknown>; summary: string; compliance?: string[] }
interface Msg { role: "user" | "assistant"; content: string; tools?: string[]; proposals?: Proposal[] }
interface Conv { id: string; title: string; agent: string; msgs: Msg[]; loaded: boolean; saved: boolean }

let seq = 0;
const draftConv = (): Conv => ({ id: `draft-${Date.now()}-${seq++}`, title: "New chat", agent: "auto", msgs: [], loaded: true, saved: false });

// minimal markdown: **bold** + line breaks (the Interrogator/Coach format with markdown)
function md(text: string): ReactNode {
  return text.split("\n").map((line, i) => (
    <div key={i}>{line.split("**").map((seg, j) => (j % 2 ? <strong key={j}>{seg}</strong> : seg))}{line === "" ? " " : ""}</div>
  ));
}

export default function ChatPage() {
  const [convs, setConvs] = useState<Conv[]>([draftConv()]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [ctx, setCtx] = useState<CtxEntity[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  // the context-feed: entities attached via "＋ Add to chat" on other pages (localStorage-backed)
  useEffect(() => { setCtx(getContext()); return subscribeContext(() => setCtx(getContext())); }, []);

  const active = convs.find((c) => c.id === activeId) ?? convs[0];
  const agent = agentById(active.agent);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [active.msgs, busy]);

  const patch = (id: string, fn: (c: Conv) => Conv) => setConvs((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));
  const bump = (id: string) => setConvs((cs) => { const i = cs.findIndex((c) => c.id === id); if (i <= 0) return cs; const c = cs[i]; return [c, ...cs.slice(0, i), ...cs.slice(i + 1)]; });

  // load saved conversations; keep a fresh draft on top
  useEffect(() => {
    fetch("/api/conversations").then((r) => r.json()).then((j) => {
      const saved: Conv[] = (j.conversations ?? []).map((c: { id: string; title: string; agent: string }) =>
        ({ id: c.id, title: c.title, agent: c.agent, msgs: [], loaded: false, saved: true }));
      setConvs([draftConv(), ...saved]);
    }).catch(() => {});
    setActiveId((id) => id);
  }, []);
  useEffect(() => { if (activeId == null && convs[0]) setActiveId(convs[0].id); }, [activeId, convs]);

  async function select(id: string) {
    setActiveId(id);
    const c = convs.find((x) => x.id === id);
    if (!c || c.loaded) return;
    const j = await fetch(`/api/conversations/${id}`).then((r) => r.json()).catch(() => ({ messages: [] }));
    const msgs: Msg[] = (j.messages ?? []).map((m: { role: "user" | "assistant"; content: string; tool_trace?: Array<{ tool: string }>; proposals?: Proposal[] }) =>
      ({ role: m.role, content: m.content, tools: (m.tool_trace ?? []).map((t) => t.tool), proposals: m.proposals ?? [] }));
    patch(id, (x) => ({ ...x, msgs, loaded: true }));
  }

  function start() {
    const existingDraft = convs.find((c) => !c.saved && c.msgs.length === 0);
    if (existingDraft) { setActiveId(existingDraft.id); return; }
    const c = draftConv(); setConvs((cs) => [c, ...cs]); setActiveId(c.id);
  }
  async function remove(id: string) {
    const c = convs.find((x) => x.id === id);
    if (c?.saved) fetch(`/api/conversations/${id}`, { method: "DELETE" }).catch(() => {});
    setConvs((cs) => { const next = cs.filter((x) => x.id !== id); const safe = next.length ? next : [draftConv()]; if (id === activeId) setActiveId(safe[0].id); return safe; });
  }
  function rename(id: string, title: string) {
    patch(id, (c) => ({ ...c, title }));
    if (convs.find((c) => c.id === id)?.saved) fetch(`/api/conversations/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title }) }).catch(() => {});
  }
  function setAgent(id: string) {
    patch(active.id, (c) => ({ ...c, agent: id }));
    if (active.saved) fetch(`/api/conversations/${active.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ agent: id }) }).catch(() => {});
  }

  const persist = (id: string, m: { role: string; agent: string; content: string; tool_trace?: unknown; proposals?: unknown }) =>
    fetch(`/api/conversations/${id}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(m) }).catch(() => {});

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const conv = active;
    const agentId = conv.agent;
    // persist the draft → a real conversation on the first message; bail (don't drop the turn) if it fails
    let id = conv.id;
    if (!conv.saved) {
      const r = await fetch("/api/conversations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ agent: agentId }) }).then((x) => x.json()).catch(() => null);
      if (!r?.conversation?.id) { alert("Couldn't start the conversation — check the connection and try again."); return; }
      id = r.conversation.id; setConvs((cs) => cs.map((c) => (c.id === conv.id ? { ...c, id, saved: true } : c))); setActiveId(id);
    }
    const userMsg: Msg = { role: "user", content: q };
    setConvs((cs) => cs.map((c) => (c.id === id ? { ...c, title: c.msgs.length === 0 ? q.slice(0, 48) : c.title, msgs: [...c.msgs, userMsg] } : c)));
    bump(id); setInput(""); setBusy(true);
    persist(id, { role: "user", agent: agentId, content: q });

    const history = [...conv.msgs, userMsg].map((m) => ({ role: m.role, content: m.content }));
    const context = ctx.map(({ type, id }) => ({ type, id }));   // attached parcels/leads → grounded server-side
    const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ agent: agentId, messages: history, context }) })
      .then((x) => x.json()).catch((e) => ({ error: String(e) }));
    setBusy(false);
    const assistant: Msg = r.error
      ? { role: "assistant", content: `⚠️ ${r.error}` }
      : { role: "assistant", content: r.text ?? "(no reply)", tools: (r.trace ?? []).map((t: { tool: string }) => t.tool), proposals: r.proposals ?? [] };
    patch(id, (c) => ({ ...c, msgs: [...c.msgs, assistant] }));
    persist(id, { role: "assistant", agent: agentId, content: assistant.content, tool_trace: r.trace ?? [], proposals: r.proposals ?? [] });
  }

  // a question typed on the Home hero lands here — send it automatically
  useEffect(() => {
    const q = sessionStorage.getItem("lot_ask");
    if (q) { sessionStorage.removeItem("lot_ask"); send(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <div key={c.id} className={`chat-conv${c.id === active.id ? " active" : ""}`} onClick={() => select(c.id)}
            onDoubleClick={() => { const t = prompt("Rename chat", c.title); if (t != null) rename(c.id, t.trim() || c.title); }}>
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
          {ctx.length > 0 && (
            <div className="ctxtray">
              <span className="eyebrow" style={{ alignSelf: "center" }}>context</span>
              {ctx.map((e) => (
                <span key={`${e.type}:${e.id}`} className="ctxchip">
                  <i className={`ti ti-${e.type === "parcel" ? "map-pin" : "user"}`} style={{ fontSize: 12 }} />
                  {e.label}
                  <i className="ti ti-x" onClick={() => removeContext(e.type, e.id)} title="Remove" />
                </span>
              ))}
            </div>
          )}
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
