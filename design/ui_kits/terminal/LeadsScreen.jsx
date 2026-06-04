/* LOT terminal — Leads: ranked motivated-owner queue. */
function LeadsScreen({ onOpenDeal }) {
  const D = window.LOT_DATA;
  const byApn = (a) => D.parcels.find((p) => p.apn === a);
  const motTier = (m) => (m >= 70 ? "strong" : m >= 50 ? "moderate" : "weak");
  return (
    <div className="reading">
      <div className="screen-head"><h1>Leads</h1><span className="sub">Motivated, by-room-legal owners — ranked by the bunny</span></div>
      <p style={{ color: "var(--text-secondary)", margin: "6px 0 18px", maxWidth: 660 }}>
        Motivation infers the <em>bunny</em> — the emotional reason an owner needs to sell — from tenure, absentee status, entity, and distress. Mail-first, compliant, no pressure.
      </p>
      <div className="tablewrap">
        <table className="lot">
          <thead><tr><th>Owner</th><th>Parcel</th><th>Segment</th><th>Signals</th><th>Motivation</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {D.leads.map((l) => (
              <tr key={l.apn}>
                <td style={{ fontWeight: 600 }}>{l.owner}<div className="mono" style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontWeight: 400 }}>{l.entity}</div></td>
                <td><span className="mono" style={{ color: "var(--text-secondary)" }}>{l.address}</span></td>
                <td>{l.segment}</td>
                <td style={{ display: "flex", gap: 4, flexWrap: "wrap", paddingTop: 12 }}>{l.distress.map((d) => <Chip key={d} mono>{d}</Chip>)}</td>
                <td><Score value={l.motivation} tier={motTier(l.motivation)} /></td>
                <td>{l.status === "mailed" ? <Sev kind="ok">mailed</Sev> : <Sev kind="warn">queued</Sev>}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btn-sm" onClick={() => byApn(l.apn) && onOpenDeal(byApn(l.apn))}><i className="ti ti-mail" /> Draft mailer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 14 }}>
        <Callout>Estate &amp; trust owners (e.g. Gordon Ave Trust) route to a separate manual-review lane — never auto-mailed. <strong>See an attorney</strong> before any creative structure.</Callout>
      </div>
      <div className="disclaimer" style={{ marginTop: 12 }}>Not a consumer report. Informational, not legal or financial advice.</div>
    </div>
  );
}
window.LeadsScreen = LeadsScreen;
