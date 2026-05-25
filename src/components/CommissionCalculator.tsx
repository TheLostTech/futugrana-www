import { useState } from "react";
import { computeAnnualCommission, getTier, DEFAULT_TIERS } from "../lib/commissions";

export default function CommissionCalculator() {
  const [referrals, setReferrals] = useState(5);
  const annual = computeAnnualCommission(referrals, DEFAULT_TIERS);
  const tier = getTier(referrals, DEFAULT_TIERS);

  return (
    <div className="bg-ink text-paper rounded-3xl p-10 max-w-2xl mx-auto" id="calcola">
      <h3 className="text-2xl font-black tracking-tight mb-2">Calcola le tue commissioni</h3>
      <p className="text-sm opacity-70 mb-8 font-medium">
        Quanti trader puoi presentare ogni mese? Il calcolo si aggiorna in tempo reale.
      </p>

      <div className="mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <label className="text-sm font-bold opacity-70">Trader referral attivi</label>
          <span className="text-2xl font-black">{referrals}</span>
        </div>
        <input
          type="range"
          min={1}
          max={50}
          value={referrals}
          onChange={(e) => setReferrals(parseInt(e.target.value, 10))}
          className="w-full accent-paper"
        />
        <div className="flex justify-between text-xs opacity-50 mt-2">
          <span>1</span>
          <span>50</span>
        </div>
      </div>

      <div className="bg-paper/5 rounded-2xl p-6 text-center">
        <p className="text-xs uppercase tracking-widest opacity-50 mb-2 font-semibold">
          Commissione attesa in 12 mesi
        </p>
        <p className="text-5xl font-black tracking-tight">
          €{annual.toLocaleString("it-IT")}
        </p>
        <p className="text-xs opacity-40 mt-3 font-mono">
          tier {tier.label} · {Math.round(tier.pct * 100)}% MRR{tier.pct === 0 ? " [placeholder]" : ""}
        </p>
      </div>
    </div>
  );
}
