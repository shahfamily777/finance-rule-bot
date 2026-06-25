"use client";

import {
  recommendDebtVsInvesting,
  type InvestingStatus,
} from "@/lib/debt-vs-investing";
import { debtSpec } from "@/lib/specs/bundle";
import { parseNum } from "@/components/guided/parse-amount";
import { useState } from "react";

const ACCENT_LIGHT = "bg-slate-50 text-slate-900 border-slate-200";
const SEND_BTN =
  "bg-gradient-to-r from-slate-700 to-stone-800 hover:from-slate-600 hover:to-stone-700 shadow-lg shadow-slate-500/30";

export function DebtVsInvestingView({ onBack }: { onBack: () => void }) {
  const [rate, setRate] = useState("");
  const [surplus, setSurplus] = useState("");
  const [has401kMatch, setHas401kMatch] = useState<boolean | null>(null);
  const [hasEmergencyFund, setHasEmergencyFund] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof recommendDebtVsInvesting> | null>(
    null
  );

  function handleSubmit() {
    setError(null);
    const rateNum = parseNum(rate);
    const surplusNum = parseNum(surplus);

    if (rateNum === null || rateNum < 0) {
      setError("Enter a valid debt interest rate.");
      return;
    }
    if (surplusNum === null) {
      setError("Enter your monthly surplus (use 0 if none).");
      return;
    }
    if (has401kMatch === null || hasEmergencyFund === null) {
      setError("Answer both investing status questions.");
      return;
    }

    const status: InvestingStatus = { has401kMatch, hasEmergencyFund };
    setResult(recommendDebtVsInvesting(rateNum, surplusNum, status));
  }

  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-slate-600">
        Compare your debt interest rate against typical investing returns using our
        deterministic rules. This is educational guidance — not a guarantee of outcomes.
      </p>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Debt interest rate (%)
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="e.g. 18"
            className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-[15px] shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Available monthly surplus ($)
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={surplus}
            onChange={(e) => setSurplus(e.target.value)}
            placeholder="e.g. 300"
            className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-[15px] shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20"
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-slate-700">
            Are you getting your full 401(k) employer match?
          </legend>
          <div className="flex gap-3">
            {(["yes", "no"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setHas401kMatch(v === "yes")}
                className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${
                  has401kMatch === (v === "yes")
                    ? "border-slate-600 bg-slate-50 text-slate-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {v === "yes" ? "Yes" : "No"}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-slate-700">
            Do you have a starter emergency fund (~$
            {debtSpec.constants.starter_emergency_fund_target.toLocaleString()})?
          </legend>
          <div className="flex gap-3">
            {(["yes", "no"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setHasEmergencyFund(v === "yes")}
                className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${
                  hasEmergencyFund === (v === "yes")
                    ? "border-slate-600 bg-slate-50 text-slate-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {v === "yes" ? "Yes" : "No"}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleSubmit}
        className={`w-full rounded-xl py-3.5 text-sm font-bold text-white sm:w-auto sm:px-8 ${SEND_BTN}`}
      >
        Get recommendation
      </button>

      {result ? (
        <div className="space-y-4">
          <div className={`rounded-xl border px-4 py-4 ${ACCENT_LIGHT}`}>
            <h3 className="text-base font-semibold">{result.headline}</h3>
            <p className="mt-2 text-sm leading-relaxed">{result.reasoning}</p>
          </div>
          {result.contextNotes.length > 0 ? (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-800">Also consider</h4>
              <ul className="space-y-2">
                {result.contextNotes.map((note, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-600">
                    <span className="text-slate-400" aria-hidden>
                      •
                    </span>
                    {note}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <p className="text-xs text-slate-500">{debtSpec.messages.disclaimer}</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <span aria-hidden>←</span> All sections
      </button>
    </div>
  );
}
