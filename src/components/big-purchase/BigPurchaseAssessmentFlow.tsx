"use client";

import { BigPurchaseResultsView } from "@/components/big-purchase/BigPurchaseResultsView";
import {
  buildBigPurchaseAssessment,
  type BigPurchaseAssessmentInput,
  type PurchaseTypeId,
} from "@/lib/big-purchase-assess";
import { bigPurchaseSpec } from "@/lib/specs/bundle";
import { parseNum } from "@/components/guided/parse-amount";
import { useEffect, useState } from "react";

type Step = {
  id: string;
  title: string;
  subtitle?: string;
};

const STEPS: Step[] = [
  {
    id: "type",
    title: "What are you buying?",
    subtitle: "Pick the category that best fits your purchase.",
  },
  {
    id: "price",
    title: "Purchase details",
    subtitle: "Enter the price and how much cash you plan to put toward it.",
  },
  {
    id: "income",
    title: "Income & savings",
    subtitle: "Your household financial picture before this purchase.",
  },
  {
    id: "debt",
    title: "Debt & payments",
    subtitle: "Existing obligations and expected costs for this purchase.",
  },
];

const HEADER_GRADIENT = "bg-gradient-to-r from-rose-700 to-orange-800";
const SEND_BTN =
  "bg-gradient-to-r from-rose-700 to-orange-800 hover:from-rose-600 hover:to-orange-700 shadow-lg shadow-rose-500/30";

const EMPTY: BigPurchaseAssessmentInput = {
  purchaseType: "other",
  purchasePrice: 0,
  downPayment: 0,
  householdAnnualIncome: 0,
  monthlySavings: 0,
  emergencyFundBalance: 0,
  existingDebtPayments: 0,
  expectedMonthlyPayment: 0,
  expectedFinancingAmount: 0,
};

export function BigPurchaseAssessmentFlow({
  onBack,
  onExploreRules,
}: {
  onBack: () => void;
  onExploreRules: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [input, setInput] = useState<BigPurchaseAssessmentInput>(EMPTY);
  const [purchaseType, setPurchaseType] = useState<PurchaseTypeId>("other");
  const [draftPrice, setDraftPrice] = useState("");
  const [draftDown, setDraftDown] = useState("");
  const [draftIncome, setDraftIncome] = useState("");
  const [draftSavings, setDraftSavings] = useState("");
  const [draftEF, setDraftEF] = useState("");
  const [draftExistingDebt, setDraftExistingDebt] = useState("");
  const [draftPayment, setDraftPayment] = useState("");
  const [draftFinancing, setDraftFinancing] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<
    typeof buildBigPurchaseAssessment
  > | null>(null);

  const step = STEPS[stepIndex];

  useEffect(() => {
    if (result) return;
    if (step.id === "price") {
      setDraftPrice(input.purchasePrice > 0 ? String(input.purchasePrice) : "");
      setDraftDown(input.downPayment > 0 ? String(input.downPayment) : "");
    } else if (step.id === "income") {
      setDraftIncome(
        input.householdAnnualIncome > 0 ? String(input.householdAnnualIncome) : ""
      );
      setDraftSavings(input.monthlySavings !== 0 ? String(input.monthlySavings) : "");
      setDraftEF(
        input.emergencyFundBalance > 0 ? String(input.emergencyFundBalance) : ""
      );
    } else if (step.id === "debt") {
      setDraftExistingDebt(
        input.existingDebtPayments > 0 ? String(input.existingDebtPayments) : ""
      );
      setDraftPayment(
        input.expectedMonthlyPayment > 0 ? String(input.expectedMonthlyPayment) : ""
      );
      setDraftFinancing(
        input.expectedFinancingAmount > 0
          ? String(input.expectedFinancingAmount)
          : ""
      );
    }
  }, [stepIndex, result, step.id, input]);

  function handleNext() {
    setError(null);

    if (step.id === "type") {
      setInput((prev) => ({ ...prev, purchaseType }));
      setStepIndex((s) => s + 1);
      return;
    }

    if (step.id === "price") {
      const price = parseNum(draftPrice);
      const down = parseNum(draftDown) ?? 0;
      if (price == null || price <= 0) {
        setError("Enter a valid purchase price.");
        return;
      }
      if (down > price) {
        setError("Down payment cannot exceed purchase price.");
        return;
      }
      const next = { ...input, purchaseType, purchasePrice: price, downPayment: down };
      setInput(next);
      setStepIndex((s) => s + 1);
      return;
    }

    if (step.id === "income") {
      const income = parseNum(draftIncome);
      const savings = parseNum(draftSavings);
      const ef = parseNum(draftEF) ?? 0;
      if (income == null || income <= 0) {
        setError("Enter your household annual income.");
        return;
      }
      if (savings == null) {
        setError("Enter monthly savings (use 0 if none).");
        return;
      }
      const next = {
        ...input,
        householdAnnualIncome: income,
        monthlySavings: savings,
        emergencyFundBalance: ef,
      };
      setInput(next);
      setStepIndex((s) => s + 1);
      return;
    }

    if (step.id === "debt") {
      const existing = parseNum(draftExistingDebt) ?? 0;
      const payment = parseNum(draftPayment) ?? 0;
      let financing = parseNum(draftFinancing);
      if (financing == null) {
        financing = Math.max(0, input.purchasePrice - input.downPayment);
      }
      const next = {
        ...input,
        existingDebtPayments: existing,
        expectedMonthlyPayment: payment,
        expectedFinancingAmount: financing,
      };
      setInput(next);
      setResult(buildBigPurchaseAssessment(next));
    }
  }

  function handleBack() {
    if (result) {
      setResult(null);
      return;
    }
    if (stepIndex === 0) {
      onBack();
      return;
    }
    setStepIndex((s) => s - 1);
  }

  if (result) {
    return (
      <BigPurchaseResultsView
        result={result}
        onBack={handleBack}
        onExploreRules={onExploreRules}
        onUpdateNumbers={() => {
          setResult(null);
          setStepIndex(0);
        }}
      />
    );
  }

  const pct = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-medium text-slate-500">
          <span>
            Step {stepIndex + 1} of {STEPS.length}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${HEADER_GRADIENT}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
        {step.subtitle ? (
          <p className="text-sm text-slate-600">{step.subtitle}</p>
        ) : null}
      </div>

      {step.id === "type" ? (
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Purchase type
          </span>
          <select
            value={purchaseType}
            onChange={(e) => setPurchaseType(e.target.value as PurchaseTypeId)}
            className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-[15px] shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
          >
            {bigPurchaseSpec.purchase_types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {step.id === "price" ? (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Purchase price ($)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={draftPrice}
              onChange={(e) => setDraftPrice(e.target.value)}
              placeholder="e.g. 35000"
              className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-[15px] shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Down payment / cash available ($)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={draftDown}
              onChange={(e) => setDraftDown(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-[15px] shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
          </label>
        </div>
      ) : null}

      {step.id === "income" ? (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Household annual income ($)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={draftIncome}
              onChange={(e) => setDraftIncome(e.target.value)}
              placeholder="e.g. 95000"
              className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-[15px] shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Monthly savings ($)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={draftSavings}
              onChange={(e) => setDraftSavings(e.target.value)}
              placeholder="e.g. 800"
              className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-[15px] shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
            <p className="mt-1 text-xs text-slate-500">
              Income minus all expenses. Use 0 or negative if spending exceeds income.
            </p>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Emergency fund balance ($)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={draftEF}
              onChange={(e) => setDraftEF(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-[15px] shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
          </label>
        </div>
      ) : null}

      {step.id === "debt" ? (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Existing debt payments ($/mo)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={draftExistingDebt}
              onChange={(e) => setDraftExistingDebt(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-[15px] shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Expected monthly payment ($)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={draftPayment}
              onChange={(e) => setDraftPayment(e.target.value)}
              placeholder="0 if paying in full"
              className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-[15px] shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Expected financing amount ($)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={draftFinancing}
              onChange={(e) => setDraftFinancing(e.target.value)}
              placeholder="Leave blank to auto-calculate"
              className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-[15px] shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
            <p className="mt-1 text-xs text-slate-500">
              Price minus down payment if left blank.
            </p>
          </label>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={handleBack}
          className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {stepIndex === 0 ? "Back" : "Previous"}
        </button>
        <button
          type="button"
          onClick={handleNext}
          className={`rounded-xl px-5 py-3 text-sm font-bold text-white ${SEND_BTN}`}
        >
          {step.id === "debt" ? "See my assessment" : "Continue"}
        </button>
      </div>
    </div>
  );
}
