import { describe, it, expect } from "vitest";
import { computeAnnualCommission, getTier, DEFAULT_TIERS } from "./commissions";

describe("getTier", () => {
  it("picks tier 1 for 0-5 referrals", () => {
    expect(getTier(0, DEFAULT_TIERS).label).toBe("1-5");
    expect(getTier(5, DEFAULT_TIERS).label).toBe("1-5");
  });
  it("picks tier 2 for 6-20 referrals", () => {
    expect(getTier(6, DEFAULT_TIERS).label).toBe("6-20");
    expect(getTier(20, DEFAULT_TIERS).label).toBe("6-20");
  });
  it("picks tier 3 for 20+", () => {
    expect(getTier(21, DEFAULT_TIERS).label).toBe("20+");
    expect(getTier(100, DEFAULT_TIERS).label).toBe("20+");
  });
});

describe("computeAnnualCommission", () => {
  it("0 referrals → 0", () => {
    expect(computeAnnualCommission(0, DEFAULT_TIERS)).toBe(0);
  });
  it("5 referrals → non-negative (placeholder pct 0)", () => {
    const result = computeAnnualCommission(5, DEFAULT_TIERS);
    expect(result).toBeGreaterThanOrEqual(0);
  });
  it("computeAnnualCommission with custom tiers respects the pct", () => {
    const tiers = [
      { label: "1-5", maxReferrals: 5, pct: 0.20 },
      { label: "6-20", maxReferrals: 20, pct: 0.25 },
      { label: "20+", maxReferrals: Infinity, pct: 0.30 },
    ];
    expect(computeAnnualCommission(5, tiers)).toBe(3000);
    expect(computeAnnualCommission(10, tiers)).toBe(7500);
  });
});
