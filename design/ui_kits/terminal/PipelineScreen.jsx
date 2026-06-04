/* LOT terminal — Pipeline: the deal board (kanban). */
function PipelineScreen({ onOpenDeal, pipeline }) {
  const D = window.LOT_DATA;
  const byApn = (a) => D.parcels.find((p) => p.apn === a);
  const label = (s) => s.replace(/_/g, " ");
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="reading" style={{ paddingBottom: 0, maxWidth: "none" }}>
        <div className="screen-head"><h1>Pipeline</h1><span className="sub">Every deal you're pursuing, by stage</span></div>
      </div>
      <div className="board">
        {D.stages.map((s) => {
          const items = pipeline[s] || [];
          return (
            <div className="col" key={s}>
              <div className="col-head">
                <Eyebrow>{label(s)}</Eyebrow>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{items.length}</span>
              </div>
              <div className="col-body">
                {items.map((d) => (
                  <div className="kanban-card" key={d.apn} onClick={() => byApn(d.apn) && onOpenDeal(byApn(d.apn))}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div className="addr">{d.address}</div>
                      <Score value={d.score} tier={d.tier} />
                    </div>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--text-secondary)", marginTop: 6 }}>{d.struct}</div>
                  </div>
                ))}
                {items.length === 0 && <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", padding: "14px 0" }}>—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
window.PipelineScreen = PipelineScreen;
