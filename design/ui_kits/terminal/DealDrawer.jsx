/* LOT terminal — right-side deal drawer (the underwrite). */
function DealDrawer({ parcel, onClose, onTrack, tracked, onAsk }) {
  const p = parcel;
  if (!p) return null;
  return (
    <div className="slideover">
      <div className="so-head">
        <button className="close" onClick={onClose}>×</button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ScoreDot value={p.score} tier={p.tier} size={34} />
          <div>
            <div style={{ font: "var(--text-h2)" }}>{p.address}</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>APN {p.apn} · Zone {p.zone}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 11, flexWrap: "wrap" }}>
          <Chip kind={p.byRoom ? "info" : ""}>{p.byRoom ? "by-room legal ✓" : "by-room: verify"}</Chip>
          <Chip mono>{p.model}</Chip>
          {p.distress.map((d) => <Chip key={d} mono>{d}</Chip>)}
        </div>
      </div>

      <div className="so-body">
        <div style={{ display: "flex", gap: 10 }}>
          <Tile k="Score" v={`${p.score}`} d="/ 100" />
          <Tile k="Headline CoC" v={`${p.coc}%`} d={`${p.cocLow}–${p.cocHigh}% band`} dColor="var(--text-secondary)" />
          <Tile k="Confidence" v={p.conf.toFixed(2)} d="data quality" />
        </div>

        <Callout>{p.note}</Callout>

        <div className="section">
          <Eyebrow>Why this score · vs your thesis</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {Object.entries(p.components).map(([k, v]) => <Bar key={k} label={k} pct={v} color={barColor(k, v)} />)}
          </div>
        </div>

        <div className="section">
          <Eyebrow>Snapshot · real county data</Eyebrow>
          <KV k="Assessed value" v={usd(p.price)} />
          <KV k="Beds" v={p.beds} />
          <KV k="Owner" v={`${p.owner} (${p.ownerType})${p.absentee ? " · absentee" : ""}`} />
          <KV k="Last sale" v={p.lastSale} />
          <KV k="Flood zone" v={p.flood} />
        </div>

        <div className="section">
          <Eyebrow>Financing · ranked</Eyebrow>
          {p.financing.map((f, i) => (
            <div key={i} style={{ marginBottom: 11, paddingBottom: 11, borderBottom: i < p.financing.length - 1 ? "1px solid var(--border-soft)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 600, fontSize: 13 }}>
                <span style={{ color: f.s.startsWith("Cash") ? "var(--positive)" : "var(--accent-bright)" }}>{i + 1}. {f.s}</span>
                {f.attorney && <Sev kind="warn">⚖ attorney review</Sev>}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>{f.pitch}</div>
              {f.guard && <div style={{ fontSize: 11, color: "var(--warn)", marginTop: 6, display: "flex", gap: 6 }}>
                <i className="ti ti-gavel" style={{ marginTop: 1 }} />{f.guard}</div>}
            </div>
          ))}
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", gap: 6, alignItems: "flex-start" }}>
            <i className="ti ti-circle-x" style={{ marginTop: 1 }} /><span>Suppressed — {p.suppressed} The engine won't force creative finance where it doesn't fit.</span>
          </div>
        </div>

        <button className="btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 18 }} onClick={() => onTrack(p)} disabled={tracked}>
          <i className="ti ti-plus" /> {tracked ? "Tracking in pipeline" : "Track this deal"}
        </button>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {onAsk && <button className="btn" style={{ flex: 1, justifyContent: "center" }} onClick={() => onAsk(p)}>
            <i className="ti ti-sparkles" style={{ color: "var(--accent-bright)" }} /> Ask LOT about this
          </button>}
          <button className="btn" style={{ flex: 1, justifyContent: "center" }}>
            <i className="ti ti-file-text" /> Full dossier
          </button>
        </div>
        <div className="disclaimer" style={{ marginTop: 14, textAlign: "center" }}>Modeled inputs labeled. Informational, not legal or financial advice.</div>
      </div>
    </div>
  );
}
window.DealDrawer = DealDrawer;
