"use client";

import { projectMonthlyContributions } from "@/lib/financial-literacy/quiz";
import type { FinancialLiteracyVisualScenario } from "@/lib/specs/types";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function CompoundGrowthVisual({
  scenarios,
}: {
  scenarios: FinancialLiteracyVisualScenario[];
}) {
  const results = scenarios.map((s) => ({
    ...s,
    projected: projectMonthlyContributions(s.monthly, s.years, s.ratePct),
  }));
  const max = Math.max(...results.map((r) => r.projected), 1);

  return (
    <div className="space-y-4 rounded-xl border border-violet-100 bg-violet-50/50 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
        Visual example (7% annual return, illustrative)
      </p>
      <div className="space-y-4">
        {results.map((r) => (
          <div key={r.label} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-slate-800">{r.label}</span>
              <span className="shrink-0 font-semibold text-violet-900">
                {formatCurrency(r.projected)}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-violet-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-700 transition-all duration-500"
                style={{ width: `${(r.projected / max) * 100}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              ${r.monthly}/mo × {r.years} years
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-slate-500">
        Illustration only — not a prediction. Actual returns vary and are not guaranteed.
      </p>
    </div>
  );
}
