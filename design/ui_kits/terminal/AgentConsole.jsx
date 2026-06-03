/* LOT terminal — Agent Console: a conversational command surface ("Claude Code for real estate").
   Talks via window.claude.complete; runs local tools (underwrite per-house/per-unit, draft & send
   email, build automations, compare) against window.LOT_DATA and renders the result as cards. */
function AgentConsole({ onOpenDeal, seed }) {
  const D = window.LOT_DATA;
  const seedP = seed && seed.p;
  const [focus, setFocus] = React.useState(seedP || null);
  const [msgs, setMsgs] = React.useState(() => seedP ? [{
    role: "assistant",
    text: `Looking at ${seedP.address} — score ${seedP.score}, ${seedP.coc}% CoC by-room, ${seedP.beds}, owner ${seedP.owner}. Ask me to underwrite it per-house or per-unit, draft the owner, or set a watch — I'll stay focused on this parcel.`,
  }] : [{
    role: "assistant",
    text: "I'm LOT. Ask me to underwrite a parcel (per-house or per-unit), draft a compliant mailer, set up an automation, or compare deals. I run the tools and show my work.",
  }]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const threadRef = React.useRef(null);
  React.useEffect(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight; }, [msgs, busy]);

  const bedCount = (s) => { const m = String(s).match(/(\d+)/); return m ? parseInt(m[1]) : 4; };
  const findParcel = (t) => {
    const q = t.toLowerCase();
    return D.parcels.find((p) => q.includes(p.address.toLowerCase().split(" ")[0] + " " + p.address.toLowerCase().split(" ")[1]))
      || D.parcels.find((p) => p.address.toLowerCase().split(/[\s,]+/).some((w) => w.length > 3 && q.includes(w)))
      || D.parcels.find((p) => q.includes(p.owner.toLowerCase().split(/[\s,]+/)[0].toLowerCase()));
  };

  const underwrite = (p) => {
    const beds = bedCount(p.beds);
    const byRoomGross = beds * 850 * 12, byRoomNOI = byRoomGross * 0.53, byRoomCoC = (byRoomNOI / p.price) * 100;
    const units = Math.max(1, Math.round(beds / 3));
    const wholeGross = units * 1850 * 12, wholeNOI = wholeGross * 0.55, wholeCoC = (wholeNOI / p.price) * 100;
    return { beds, units, byRoomGross, byRoomNOI, byRoomCoC, wholeGross, wholeNOI, wholeCoC };
  };

  const detect = (t) => {
    const q = t.toLowerCase(), p = findParcel(t) || focus;
    if (/automat|every week|weekly|flow|whenever|each time|when a|alert me|recurring|watch|price[\s-]?drop/.test(q)) return { tool: "automate", p };
    if (/email|mail|letter|reach out|contact|outreach|draft/.test(q)) return { tool: "email", p };
    if (/compare|versus|\bvs\b|stack up|against/.test(q)) return { tool: "compare", p };
    if (/underwrit|analyz|score|cash|coc|per[\s-]?unit|per[\s-]?room|by[\s-]?room|run the numbers|pencil/.test(q) && p) return { tool: "analyze", p, mode: /unit/.test(q) ? "unit" : /room|bed/.test(q) ? "room" : "both" };
    if (p) return { tool: "analyze", p, mode: "both" };
    return { tool: null, p: null };
  };

  function buildCard(d, text) {
    if (!d.tool) return null;
    const p = d.p;
    if (d.tool === "analyze" && p) {
      const u = underwrite(p);
      return { kind: "analyze", p, u, mode: d.mode };
    }
    if (d.tool === "email" && p) {
      return { kind: "email", p, status: "draft",
        subject: `A direct, no-obligation offer on ${p.address}`,
        body: `Dear ${p.owner.split(/[ ,]/)[0] === p.owner ? "Owner" : p.owner.split(",")[0]},\n\nI'm a local buyer focused on the ${p.zone} blocks near Grounds. I'm reaching out directly about ${p.address} — no agent, no pressure. If you've ever thought about selling, I can offer a flexible close (cash, or terms that spread your tax over time) and cover closing costs.\n\nWould a short call this week be welcome? Reply anytime — or not at all; I won't follow up more than once.\n\n— Nate · LOT` };
    }
    if (d.tool === "automate") {
      return { kind: "automate", p, name: p ? `Watch ${p.address}` : "Weekly tired-landlord outreach",
        trigger: p ? `When ${p.address} drops in price or flips legality` : "Every Monday 06:00, after refresh_run",
        steps: p
          ? ["Re-underwrite per-house + per-unit", "If CoC ≥ 5% → add to Pipeline · Analyzing", "Notify me in the Brief"]
          : ["Query absentee owners, tenure ≥ 10y, by-room legal", "Rank by motivation (the bunny)", "Draft compliant mailers (≤ budget)", "Queue for my one-click approval"],
        enabled: false };
    }
    if (d.tool === "compare") {
      const top = [...D.parcels].sort((a, b) => b.score - a.score).slice(0, 2);
      return { kind: "compare", rows: top };
    }
    return null;
  }

  async function narrate(text, card) {
    const ctx = D.parcels.map((p) => `${p.address} (score ${p.score}, ${p.coc}% CoC, ${p.beds}, ${p.zone}, owner ${p.owner})`).join("; ");
    const toolNote = card ? `A ${card.kind} tool card is being shown to the user.` : "No tool was run.";
    const prompt = `You are LOT, an AI real-estate acquisition copilot for one investor (Nate) in Charlottesville. Terse, concrete, operator-to-operator — 1 to 2 short sentences, no preamble. Never give legal/financial advice; for any creative-finance structure add a brief "see an attorney" note. Parcels: ${ctx}. ${toolNote}\n\nUser: ${text}`;
    try {
      const r = await window.claude.complete({ messages: [{ role: "user", content: prompt }] });
      return (r || "").trim() || "Done.";
    } catch (e) {
      if (card && card.kind === "analyze") return `Ran both models on ${card.p.address}. By-room pencils stronger here — confirm the bed count before you trust it.`;
      if (card && card.kind === "email") return `Drafted a compliant, no-pressure first touch to ${card.p.owner}. Review, then send when you're ready.`;
      if (card && card.kind === "automate") return `Set up "${card.name}". It stays paused until you enable it.`;
      if (card && card.kind === "compare") return `Side by side — both are strong-tier; the higher CoC is the cleaner buy.`;
      return "I can underwrite a parcel, draft a mailer, or wire an automation — point me at one.";
    }
  }

  async function send(text) {
    const t = (text || input).trim(); if (!t || busy) return;
    setInput(""); setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: t }]);
    const d = detect(t); const card = buildCard(d, t);
    const narration = await narrate(t, card);
    setMsgs((m) => [...m, { role: "assistant", text: narration, card }]);
    setBusy(false);
  }

  const suggestions = focus
    ? ["Underwrite per-unit", "Underwrite per-house", "Draft the owner", "Set a price-drop watch"]
    : ["Underwrite 1305 Grady per-unit", "Draft a mailer to Marcus Whitfield", "Automate weekly tired-landlord outreach", "Compare my top 2 deals"];

  return (
    <div className="console">
      <div className="console-thread" ref={threadRef}>
        <div className="console-inner">
          {msgs.map((m, i) => (
            <div key={i} className={`turn ${m.role}`}>
              {m.role === "assistant" && <img src="../../assets/lot-mark.svg" width="22" height="22" alt="" className="turn-avatar" />}
              <div className="turn-body">
                <div className={`bubble ${m.role}`}>{m.text}</div>
                {m.card && <ToolCard card={m.card} onOpenDeal={onOpenDeal} />}
              </div>
            </div>
          ))}
          {busy && <div className="turn assistant"><img src="../../assets/lot-mark.svg" width="22" height="22" alt="" className="turn-avatar" /><div className="turn-body"><div className="bubble assistant typing"><span /><span /><span /></div></div></div>}
        </div>
      </div>
      <div className="composer-wrap">
        <div className="console-inner">
          {focus && (
            <div className="focus-bar">
              <span className="chip info"><i className="ti ti-map-pin" /> {focus.address} · {focus.score}</span>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>context locked to this parcel</span>
              <button className="btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => setFocus(null)}><i className="ti ti-x" /> clear</button>
            </div>
          )}
          <div className="suggest">
            {suggestions.map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
          </div>
          <div className="composer">
            <i className="ti ti-sparkles" />
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask LOT to analyze, draft, automate… (per-house or per-unit)" />
            <button className="btn-primary" onClick={() => send()} disabled={busy}><i className="ti ti-arrow-up" /></button>
          </div>
          <div className="disclaimer" style={{ textAlign: "center", marginTop: 8 }}>LOT runs tools on modeled data. Informational, not legal or financial advice.</div>
        </div>
      </div>
    </div>
  );
}

function ToolCard({ card, onOpenDeal }) {
  const [enabled, setEnabled] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const m = (n) => `$${Math.round(n).toLocaleString()}`;

  if (card.kind === "analyze") {
    const { p, u, mode } = card;
    const recRoom = p.byRoom && u.byRoomCoC >= u.wholeCoC;
    const cocColor = (c) => (c >= 5 ? "var(--positive)" : c >= 4 ? "var(--warn)" : "var(--critical)");
    const askedRoom = mode === "room", askedUnit = mode === "unit";
    return (
      <div className="toolcard">
        <div className="tc-head"><i className="ti ti-calculator" /> underwrite · <span className="mono">{p.address}</span> <span className="tc-run">real assessed value · rents modeled</span></div>
        <table className="uw">
          <thead><tr><th></th>
            <th className={recRoom ? "rec" : ""}>By-room / bed{recRoom ? " ★" : ""}{askedRoom ? " ◂" : ""}</th>
            <th className={!recRoom ? "rec" : ""}>Whole-house / unit{!recRoom ? " ★" : ""}{askedUnit ? " ◂" : ""}</th></tr></thead>
          <tbody>
            <tr><td>basis</td><td>{u.beds} bd × $850</td><td>{u.units}u × $1,850</td></tr>
            <tr><td>gross / yr</td><td className="mono">{m(u.byRoomGross)}</td><td className="mono">{m(u.wholeGross)}</td></tr>
            <tr><td>NOI</td><td className="mono">{m(u.byRoomNOI)}</td><td className="mono">{m(u.wholeNOI)}</td></tr>
            <tr><td>cash-on-cash</td>
              <td className="mono" style={{ color: cocColor(u.byRoomCoC), fontWeight: 700 }}>{u.byRoomCoC.toFixed(1)}%</td>
              <td className="mono" style={{ color: cocColor(u.wholeCoC), fontWeight: 700 }}>{u.wholeCoC.toFixed(1)}%</td></tr>
          </tbody>
        </table>
        <div className="tc-foot">
          <span className="mono" style={{ color: "var(--text-tertiary)" }}>assessed {usd(p.price)} · {p.zone} · by-room {p.byRoom ? "legal ✓" : "verify"}</span>
          <button className="btn btn-sm" onClick={() => onOpenDeal(p)}><i className="ti ti-external-link" /> Open dossier</button>
        </div>
      </div>
    );
  }
  if (card.kind === "email") {
    const { p } = card;
    const gmail = "https://mail.google.com/mail/?view=cm&fs=1&su=" + encodeURIComponent(card.subject) + "&body=" + encodeURIComponent(card.body);
    return (
      <div className="toolcard">
        <div className="tc-head"><i className="ti ti-mail" /> draft mailer · <span className="mono">{p.owner}</span> <span className="tc-run">compliant first-touch · ≤1 follow-up</span></div>
        <div className="email">
          <div className="email-row"><span>To</span><b>{p.owner} · {p.address}</b></div>
          <div className="email-row"><span>Subject</span><b>{card.subject}</b></div>
          <pre className="email-body">{card.body}</pre>
        </div>
        <div className="tc-foot">
          <span className="mono" style={{ color: sent ? "var(--positive)" : "var(--text-tertiary)" }}>{sent ? "✓ opened in Gmail · logged to outreach_event" : "draft · via your Gmail"}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-sm"><i className="ti ti-pencil" /> Edit</button>
            <button className="btn-primary btn-sm" onClick={() => { window.open(gmail, "_blank", "noopener"); setSent(true); }}>
              <i className="ti ti-brand-google" /> {sent ? "Opened in Gmail" : "Approve & open in Gmail"}
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (card.kind === "automate") {
    return (
      <div className="toolcard">
        <div className="tc-head"><i className="ti ti-bolt" /> automation · <span className="mono">{card.name}</span></div>
        <div className="auto-trigger"><Eyebrow>Trigger</Eyebrow><div style={{ fontSize: 12.5, marginTop: 4 }}>{card.trigger}</div></div>
        <div className="auto-steps">
          {card.steps.map((s, i) => <div className="auto-step" key={i}><span className="mono num">{i + 1}</span><span>{s}</span></div>)}
        </div>
        <div className="tc-foot">
          <span className="mono" style={{ color: enabled ? "var(--positive)" : "var(--text-tertiary)" }}>{enabled ? "● active" : "○ paused"}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Enable</span><Toggle on={enabled} onClick={() => setEnabled(!enabled)} /></div>
        </div>
      </div>
    );
  }
  if (card.kind === "compare") {
    return (
      <div className="toolcard">
        <div className="tc-head"><i className="ti ti-arrows-left-right" /> compare · top matches</div>
        <table className="lot" style={{ fontSize: 12 }}>
          <thead><tr><th>Parcel</th><th>Score</th><th>CoC</th><th>Price</th><th>Structure</th></tr></thead>
          <tbody>
            {card.rows.map((p) => (
              <tr key={p.apn} onClick={() => onOpenDeal(p)} style={{ cursor: "pointer" }}>
                <td style={{ fontWeight: 600 }}>{p.address}</td><td><Score value={p.score} tier={p.tier} /></td>
                <td className="mono">{p.coc}%</td><td className="mono">{usd(p.price)}</td><td>{p.financing[0].s.split(" ")[0]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}
window.AgentConsole = AgentConsole;
