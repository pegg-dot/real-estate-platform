/* LOT terminal — the Monday Brief: ranked action queues. */
function BriefScreen({ onOpenDeal }) {
  const D = window.LOT_DATA;
  const sevColor = { critical: "var(--critical)", warn: "var(--warn)", ok: "var(--positive)" };
  const byApn = (a) => D.parcels.find((p) => p.apn === a);
  return (
    <div className="reading">
      <div className="screen-head">
        <h1>The Monday Brief</h1>
        <span className="sub">Charlottesville · 8 actions · refreshed 06:00</span>
      </div>
      <p style={{ color: "var(--text-secondary)", marginBottom: 16, maxWidth: 640 }}>
        Your week, ranked. One reason per row, one action per row. The loop sharpens from every advance/pass.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <Btn icon="refresh">Generate leads</Btn>
        <Btn icon="brain">Propose thesis retune</Btn>
      </div>

      {D.briefQueues.map((Q) => (
        <div className="queue" key={Q.q}>
          <Eyebrow style={{ marginBottom: 9, display: "flex", gap: 8, alignItems: "center" }}>
            <Sev kind={Q.sev}>{Q.label}</Sev> <span style={{ color: "var(--text-tertiary)" }}>{Q.rows.length}</span>
          </Eyebrow>
          {Q.rows.map((r, i) => (
            <div className="queue-row" key={i}>
              <span className="accent-bar" style={{ background: sevColor[Q.sev] }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{r.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{r.reason}</div>
              </div>
              {r.target && byApn(r.target)
                ? <button className="btn btn-sm" onClick={() => onOpenDeal(byApn(r.target))}>{r.action}</button>
                : <button className="btn btn-sm">{r.action}</button>}
            </div>
          ))}
        </div>
      ))}
      <div className="disclaimer" style={{ marginTop: 8 }}>Informational, not legal or financial advice.</div>
    </div>
  );
}
window.BriefScreen = BriefScreen;
