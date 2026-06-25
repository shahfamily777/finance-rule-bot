"use client";

import {
  calculatePayoffDate,
  formatPayoffDate,
} from "@/lib/debt-calculator";
import { debtSpec } from "@/lib/specs/bundle";
import { parseNum } from "@/components/guided/parse-amount";
import { useState } from "react";

const ACCENT_LIGHT = "bg-slate-50 text-slate-900 border-slate-200";
const SEND_BTN =
  "bg-gradient-to-r from-slate-700 to-stone-800 hover:from-slate-600 hover:to-stone-700 shadow-lg shadow-slate-500/30";

export function DebtFreeDateCalculator({ onBack }: { onBack: () => void }) {
  const [balance, setBalance] = useState("");
  const [rate, setRate] = useState("");
  const [payment, setPayment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<
    ReturnType<typeof calculatePayoffDate>,
    { ok: true }
  > | null>(null);

  function handleCalculate() {
    setError(null);
    setResult(null);

    const bal = parseNum(balance);
    const rateNum = parseNum(rate);
    const pay = parseNum(payment);

    if (bal === null || bal <= 0) {
      setError("Enter a valid debt balance greater than zero.");
      return;
    }
    if (rateNum === null || rateNum < 0) {
      setError("Enter a valid interest rate.");
      return;
    }
    if (pay === null || pay <= 0) {
      setError("Enter a valid monthly payment greater than zero.");
      return;
    }

    const calc = calculatePayoffDate(bal, rateNum, pay);
    if (!calc.ok) {
      setError(calc.error);
      return;
    }
    setResult(calc);
  }

  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-slate-600">
        Estimate when a single debt could be paid off at your current monthly payment.
        Actual timelines may vary if rates or payments change.
      </p>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Debt balance ($)
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="e.g. 12000"
            className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-[15px] shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Interest rate (%)
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="e.g. 15.99"
            className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-[15px] shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Monthly payment ($)
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
            placeholder="e.g. 350"
            className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-[15px] shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20"
          />
        </label>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleCalculate}
        className={`w-full rounded-xl py-3.5 text-sm font-bold text-white sm:w-auto sm:px-8 ${SEND_BTN}`}
      >
        Calculate payoff date
      </button>

      {result ? (
        <div className={`rounded-xl border px-5 py-5 ${ACCENT_LIGHT}`}>
          <h3 className="text-base font-semibold">Estimated payoff</h3>
          <dl className="mt-4 space-y-3">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
              <dt className="text-sm font-medium text-slate-600">Payoff date</dt>
              <dd className="text-sm font-semibold text-slate-900">
                {formatPayoffDate(result.payoffDate)}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
              <dt className="text-sm font-medium text-slate-600">Months remaining</dt>
              <dd className="text-sm font-semibold text-slate-900">
                {result.monthsRemaining}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
              <dt className="text-sm font-medium text-slate-600">Total interest paid</dt>
              <dd className="text-sm font-semibold text-slate-900">
                ${result.totalInterestPaid.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-500">{debtSpec.messages.disclaimer}</p>
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
