export interface Tier {
  label: string;
  maxReferrals: number;
  pct: number;
}

// PLACEHOLDER percentages — see spec section 11 open question #2.
// Set to 0 by default so the calculator renders €0 until real numbers are decided.
export const DEFAULT_TIERS: Tier[] = [
  { label: "1-5", maxReferrals: 5, pct: 0 },
  { label: "6-20", maxReferrals: 20, pct: 0 },
  { label: "20+", maxReferrals: Infinity, pct: 0 },
];

export const AVG_PLAN_PRICE_EUR = 250;
const MONTHS_PER_YEAR = 12;

export function getTier(referrals: number, tiers: Tier[]): Tier {
  for (const t of tiers) {
    if (referrals <= t.maxReferrals) return t;
  }
  return tiers[tiers.length - 1];
}

export function computeAnnualCommission(referrals: number, tiers: Tier[]): number {
  if (referrals <= 0) return 0;
  const tier = getTier(referrals, tiers);
  return Math.round(referrals * AVG_PLAN_PRICE_EUR * tier.pct * MONTHS_PER_YEAR);
}
