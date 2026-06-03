/* LOT terminal — app shell: top chrome, tab nav, screen routing, bottom time rail. */
function App() {
  const D = window.LOT_DATA;
  const [screen, setScreen] = React.useState("map");
  const [selected, setSelected] = React.useState(null);
  const [tracked, setTracked] = React.useState(["060118000", "040303000", "060123000", "060131000", "060140000", "060109000"]);
  const [pipeline, setPipeline] = React.useState(D.pipeline);
  const [seed, setSeed] = React.useState(null);

  const openDeal = (p) => { setSelected(p); setScreen("map"); };
  const openConsole = (p) => { setSeed({ p, at: Date.now() }); setSelected(null); setScreen("console"); };
  const onTrack = (p) => {
    if (tracked.includes(p.apn)) return;
    setTracked((t) => [...t, p.apn]);
    setPipeline((pl) => ({ ...pl, analyzing: [...pl.analyzing, { apn: p.apn, address: p.address, score: p.score, tier: p.tier, struct: p.financing[0].s.split(" ")[0] }] }));
  };

  const tabs = [["map", "Map", "map-2"], ["console", "Console", "sparkles"], ["brief", "Brief", "layout-list"], ["pipeline", "Pipeline", "columns-3"], ["leads", "Leads", "address-book"], ["settings", "Settings", "settings"]];

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <img className="logo-img" src="../../assets/lot-mark.svg" width="26" height="26" alt="LOT"
               style={{ display: "block" }} />
          <span className="name">LOT</span>
          <span className="loc">/ {D.market}, VA</span>
        </div>
        <div className="nav">
          {tabs.map(([id, label, icon]) => (
            <button key={id} className={screen === id ? "active" : ""} onClick={() => setScreen(id)}>
              <i className={`ti ti-${icon}`} /> {label}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <button className="searchbar" onClick={() => setScreen("console")} style={{ cursor: "pointer" }}><i className="ti ti-sparkles" style={{ fontSize: 14, color: "var(--accent-bright)" }} /> Ask LOT to run something <span className="kbd">⌘K</span></button>
        <div className="live"><span className="dot" /> live</div>
      </div>

      <div className={`screen ${screen === "map" ? "flush" : ""}`}>
        {screen === "map" && <MapScreen selected={selected} setSelected={setSelected} tracked={tracked} onTrack={onTrack} onAsk={openConsole} />}
        {screen === "console" && <AgentConsole onOpenDeal={openDeal} seed={seed} />}
        {screen === "brief" && <BriefScreen onOpenDeal={openDeal} />}
        {screen === "pipeline" && <PipelineScreen onOpenDeal={openDeal} pipeline={pipeline} />}
        {screen === "leads" && <LeadsScreen onOpenDeal={openDeal} />}
        {screen === "settings" && <SettingsScreen />}
      </div>

      <div className="timeline">
        <span style={{ color: "var(--accent-bright)", marginRight: 10 }}><i className="ti ti-history" /> change feed</span>
        {["−6w", "−5w", "−4w", "−3w", "−2w", "−1w"].map((t) => <span className="tick" key={t}>{t}</span>)}
        <span className="tick now">▸ now</span>
        <span className="tick" style={{ color: "var(--text-tertiary)" }}>+1w</span>
        <span style={{ marginLeft: "auto", color: "var(--text-tertiary)" }}>refresh_run · {D.parcels.length} parcels scored</span>
      </div>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
