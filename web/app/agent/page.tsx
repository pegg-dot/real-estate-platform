"use client";
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
    <div className="page" style={{ maxWidth: 820 }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Agent — your LOT operator</h1>
      <p className="muted" style={{ marginBottom: 14 }}>
        Ask anything in plain English. It reads the whole database, runs the analyses, and <em>proposes</em>
        actions you approve — it never writes or sends on its own. (Needs Anthropic credits to run.)
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%",
            background: m.role === "user" ? "#0f172a" : "#f1f5f9", color: m.role === "user" ? "#fff" : "#0f172a",
            padding: "8px 12px", borderRadius: 10, fontSize: 13, whiteSpace: "pre-wrap" }}>
            {m.content}
            {m.tools && m.tools.length > 0 && (
              <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>tools: {m.tools.join(", ")}</div>
            )}
            {m.proposals && m.proposals.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {m.proposals.map((p, j) => (
                  <div key={j} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
                    <div style={{ fontWeight: 600 }}>Proposed: {p.summary}</div>
                    {(p.compliance ?? []).map((c, k) => <div key={k} className="muted" style={{ fontSize: 11 }}>⚖️ {c}</div>)}
                    <button onClick={() => approve(p)} style={{ marginTop: 6, padding: "4px 10px", border: "1px solid #0f172a", background: "#0f172a", color: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Approve & run</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="muted" style={{ fontSize: 12 }}>thinking…</div>}
      </div>

      <form onSubmit={send} style={{ display: "flex", gap: 6, position: "sticky", bottom: 12 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy}
          placeholder='e.g. "show tired-landlord leads near grounds under $400k and draft a mailer for the top one"'
          style={{ flex: 1, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13 }} />
        <button type="submit" disabled={busy} style={{ padding: "8px 14px", border: "1px solid #0f172a", background: "#0f172a", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Send</button>
      </form>
    </div>
  );
}
