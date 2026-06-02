"use client";
import { useEffect, useState } from "react";

interface Change { change_type: string; severity: string; detail: Record<string, unknown>; apn: string; address: string | null }
const ICON: Record<string, string> = { high: "🔴", notable: "🟠", info: "⚪️" };

export default function ChangesPage() {
  const [data, setData] = useState<{ baseline: boolean; changes: Change[] } | null>(null);
  useEffect(() => { fetch("/api/changes").then((r) => r.json()).then(setData); }, []);
  if (!data) return <div className="page"><p className="muted">Loading…</p></div>;

  return (
    <div className="page">
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Changes — what moved since last run</h1>
      {data.baseline && <p className="muted">📷 Baseline captured. Change tracking starts after the next refresh — there&apos;s nothing to diff against yet. Run a refresh (`npm run refresh`) to build history.</p>}
      {!data.baseline && data.changes.length === 0 && <p className="muted">✓ No material changes since the last run.</p>}
      {data.changes.length > 0 && (
        <table>
          <thead><tr><th></th><th>Property</th><th>Change</th><th>Detail</th></tr></thead>
          <tbody>
            {data.changes.map((c, i) => (
              <tr key={i}>
                <td>{ICON[c.severity] ?? ""}</td>
                <td>{c.address ?? c.apn}</td>
                <td>{c.change_type.replace(/_/g, " ")}</td>
                <td className="muted">{summarize(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function summarize(c: Change): string {
  const d = c.detail || {};
  if (c.change_type === "price_change") return `${d.direction} ${pct(d.deltaPct)} (${usd(d.from)}→${usd(d.to)})`;
  if (c.change_type.startsWith("score_")) return `${d.from}→${d.to}`;
  if (c.change_type === "ownership_change") return `new sale ${usd(d.toPrice)}`;
  if (c.change_type === "by_room_legality_change") return `${d.from}→${d.to}`;
  return "";
}
const usd = (n: unknown) => (typeof n === "number" ? `$${Math.round(n).toLocaleString()}` : "—");
const pct = (n: unknown) => (typeof n === "number" ? `${(n * 100).toFixed(1)}%` : "—");
