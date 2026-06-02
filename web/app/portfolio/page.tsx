import { runEngine } from "../lib/engine";

export const dynamic = "force-dynamic";

interface Advice {
  model: {
    count: number; totalValue: number; totalEquity: number; totalCashFlow: number; cashOnCash: number;
    topConcentration: { dimension: string; key: string; share: number } | null;
  };
  horizonMix: { today: number; tomorrow: number; forever: number };
  nextBuy: Array<{ id: string; standaloneScore: number; portfolioFit: number; market: string; exitStrategy: string | null; reasons: string[] }>;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default async function PortfolioPage() {
  let a: Advice | null = null;
  let err: string | null = null;
  try { a = JSON.parse((await runEngine("portfolio.ts", ["--json"])).trim()) as Advice; }
  catch (e) { err = (e as Error).message; }

  return (
    <div className="page">
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Portfolio Strategy Advisor</h1>
      <p className="muted" style={{ marginBottom: 14 }}>
        The zoom-out: what you own, your concentration, and the best <em>next</em> buy — the one that
        improves the portfolio, not just the highest standalone score.
      </p>
      {err && <p style={{ color: "#b91c1c" }}>⚠️ {err}</p>}
      {a && (
        <>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 14 }}>
            <Stat label="Owned" value={String(a.model.count)} />
            <Stat label="Value" value={usd(a.model.totalValue)} />
            <Stat label="Equity" value={usd(a.model.totalEquity)} />
            <Stat label="Cash flow / yr" value={usd(a.model.totalCashFlow)} />
            <Stat label="Blended CoC" value={`${(a.model.cashOnCash * 100).toFixed(1)}%`} />
          </div>
          <p className="muted" style={{ marginBottom: 6 }}>
            Money-horizon mix — today {a.horizonMix.today} · tomorrow {a.horizonMix.tomorrow} · forever {a.horizonMix.forever}
          </p>
          <p className="muted" style={{ marginBottom: 16 }}>
            {a.model.topConcentration
              ? `Top concentration: ${(a.model.topConcentration.share * 100).toFixed(0)}% ${a.model.topConcentration.dimension} in ${a.model.topConcentration.key}`
              : "Empty portfolio — recommendations are first-buy candidates aligned to the thesis."}
          </p>

          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Best next buy</h2>
          <p className="muted" style={{ fontSize: 11, marginBottom: 8 }}>
            Indicative only — recommendations respect the financing/legal guardrails (see each deal&apos;s
            financing) and are not investment advice. Numbers are modeled until real comps/closings exist.
          </p>
          <table>
            <thead><tr><th>Parcel</th><th>Portfolio fit</th><th>Standalone</th><th>Market / strategy</th><th>Why</th></tr></thead>
            <tbody>
              {a.nextBuy.map((b) => (
                <tr key={b.id}>
                  <td><a href={`/map?apn=${b.id}`}>{b.id}</a></td>
                  <td><strong>{b.portfolioFit}</strong></td>
                  <td className="muted">{b.standaloneScore.toFixed(0)}</td>
                  <td className="muted">{b.market}{b.exitStrategy ? ` · ${b.exitStrategy.replace(/_/g, " ")}` : ""}</td>
                  <td className="muted">{b.reasons[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 11 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
