/**
 * Marketing-ROI + funnel KPIs (spec 015 Part A). Rolls the acquisition funnel
 * (leads → contacts → appointments → contracts → closes) into stage conversion rates and
 * cost-per-contact / cost-per-deal from channel spend. Pure + deterministic; counts come from the
 * deal pipeline + lead queue, spend from config cost assumptions (mail ~$1/pc, skip-trace ~12¢).
 * Every rate guards divide-by-zero so an empty funnel reads 0/null, never NaN/Infinity.
 */
export interface FunnelCounts {
  leads: number;
  contacts: number;
  appointments: number;
  contracts: number;
  closes: number;
}

export interface ChannelSpend { channel: string; pieces: number; costPerPiece: number }

export interface FunnelKpis {
  counts: FunnelCounts;
  rates: { contactRate: number; apptRate: number; contractRate: number; closeRate: number; leadToClose: number };
  spend: number;
  costPerContact: number | null;   // null when no contacts (no divide-by-zero)
  costPerDeal: number | null;      // null when no closes
}

const rate = (num: number, den: number) => (den > 0 ? num / den : 0);

export function funnelKpis(counts: FunnelCounts, spend: ChannelSpend[]): FunnelKpis {
  const total = spend.reduce((s, c) => s + c.pieces * c.costPerPiece, 0);
  return {
    counts,
    rates: {
      contactRate: rate(counts.contacts, counts.leads),
      apptRate: rate(counts.appointments, counts.contacts),
      contractRate: rate(counts.contracts, counts.appointments),
      closeRate: rate(counts.closes, counts.contracts),
      leadToClose: rate(counts.closes, counts.leads),
    },
    spend: total,
    costPerContact: counts.contacts > 0 ? total / counts.contacts : null,
    costPerDeal: counts.closes > 0 ? total / counts.closes : null,
  };
}
