"use client";

import { AssessmentView } from "@/components/AssessmentView";
import {
  buildDebtStructuredAssessment,
  type DebtAssessmentInput,
  type DebtItem,
} from "@/lib/debt-assess";
import { debtSpec } from "@/lib/specs/bundle";
import type { SectionTheme } from "@/lib/section-theme";
import { parseNum } from "@/components/guided/parse-amount";
import { useEffect, useState } from "react";

const DEBT_THEME: SectionTheme = {
  id: "investment",
  label: "Debt",
  emoji: "💳",
  hub: {
    gradient: "bg-gradient-to-br from-slate-700 to-stone-900",
    iconBg: "bg-white/15",
    iconColor: "text-white",
    border: "border-slate-200/60",
    shadow: "shadow-lg shadow-slate-500/20",
    hoverShadow: "hover:shadow-xl hover:shadow-slate-500/30",
  },
  shell: {
    headerGradient: "bg-gradient-to-r from-slate-700 to-stone-800",
    accent: "text-slate-700",
    accentLight: "bg-slate-50 text-slate-900 border-slate-200",
    ring: "ring-slate-500/30 focus-visible:ring-slate-500",
    choiceActive: "border-slate-600 bg-slate-50 text-slate-900 ring-2 ring-slate-500/20",
  },
  chat: {
    userBubble: "bg-gradient-to-br from-slate-700 to-stone-800 text-white shadow-md shadow-slate-500/25",
    assistantBubble:
      "bg-white/95 text-slate-800 border border-slate-200 shadow-sm ring-1 ring-slate-50",
    composerBg: "bg-gradient-to-t from-slate-50/90 to-white/80",
    sendBtn:
      "bg-gradient-to-r from-slate-700 to-stone-800 hover:from-slate-600 hover:to-stone-700 shadow-lg shadow-slate-500/30",
    sendBtnDisabled: "bg-slate-200 text-slate-400 shadow-none",
  },
  submitBtn:
    "bg-gradient-to-r from-slate-700 to-stone-800 hover:from-slate-600 hover:to-stone-700 shadow-lg shadow-slate-500/25",
};

type Step = {
  id: string;
  title: string;
  subtitle?: string;
  fields: { key: keyof DebtAssessmentInput; label: string; hint?: string; isRate?: boolean }[];
};

const STEPS: Step[] = [
  {
    id: "credit-card",
    title: "Credit card",
    subtitle: "Enter your balance and interest rate. Use 0 if none.",
    fields: [
      { key: "creditCard", label: "Balance ($)", hint: "e.g. 4500" },
      { key: "creditCard", label: "Interest rate (%)", hint: "e.g. 22.99", isRate: true },
    ],
  },
  {
    id: "personal-loan",
    title: "Personal loan",
    subtitle: "Unsecured personal loan balance and rate.",
    fields: [
      { key: "personalLoan", label: "Balance ($)" },
      { key: "personalLoan", label: "Interest rate (%)", isRate: true },
    ],
  },
  {
    id: "auto-loan",
    title: "Auto loan",
    subtitle: "Car loan balance and rate.",
    fields: [
      { key: "autoLoan", label: "Balance ($)" },
      { key: "autoLoan", label: "Interest rate (%)", isRate: true },
    ],
  },
  {
    id: "student-loan",
    title: "Student loan",
    subtitle: "Federal or private student loan.",
    fields: [
      { key: "studentLoan", label: "Balance ($)" },
      { key: "studentLoan", label: "Interest rate (%)", isRate: true },
    ],
  },
  {
    id: "mortgage",
    title: "Mortgage",
    subtitle: "Remaining mortgage balance and rate.",
    fields: [
      { key: "mortgage", label: "Balance ($)" },
      { key: "mortgage", label: "Interest rate (%)", isRate: true },
    ],
  },
  {
    id: "cash-flow",
    title: "Cash flow & savings",
    subtitle: "Emergency fund and monthly surplus after all expenses.",
    fields: [
      {
        key: "emergencyFund",
        label: "Emergency fund ($)",
        hint: `Starter target ~$${debtSpec.constants.starter_emergency_fund_target.toLocaleString()}`,
      },
      {
        key: "monthlySurplus",
        label: "Monthly surplus cash flow ($)",
        hint: "Income minus expenses — can be negative",
      },
    ],
  },
];

const EMPTY: DebtAssessmentInput = {
  creditCard: { balance: 0, interestRatePct: 0 },
  personalLoan: { balance: 0, interestRatePct: 0 },
  autoLoan: { balance: 0, interestRatePct: 0 },
  studentLoan: { balance: 0, interestRatePct: 0 },
  mortgage: { balance: 0, interestRatePct: 0 },
  emergencyFund: 0,
  monthlySurplus: 0,
};

export function DebtAssessmentFlow({
  onBack,
  onExploreRules,
}: {
  onBack: () => void;
  onExploreRules: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [input, setInput] = useState<DebtAssessmentInput>(EMPTY);
  const [draftBalance, setDraftBalance] = useState("");
  const [draftRate, setDraftRate] = useState("");
  const [draftEmergency, setDraftEmergency] = useState("");
  const [draftSurplus, setDraftSurplus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<ReturnType<
    typeof buildDebtStructuredAssessment
  > | null>(null);

  const step = STEPS[stepIndex];
  const isDebtStep = step.id !== "cash-flow";

  useEffect(() => {
    if (assessment) return;
    if (step.id === "cash-flow") {
      setDraftEmergency(input.emergencyFund > 0 ? String(input.emergencyFund) : "");
      setDraftSurplus(input.monthlySurplus !== 0 ? String(input.monthlySurplus) : "");
    } else {
      const key = step.fields[0].key as keyof Pick<
        DebtAssessmentInput,
        "creditCard" | "personalLoan" | "autoLoan" | "studentLoan" | "mortgage"
      >;
      const item = input[key] as DebtItem;
      setDraftBalance(item.balance > 0 ? String(item.balance) : "");
      setDraftRate(item.interestRatePct > 0 ? String(item.interestRatePct) : "");
    }
  }, [stepIndex, assessment, step.id, step.fields, input]);

  function handleNext() {
    setError(null);

    if (step.id === "cash-flow") {
      const ef = parseNum(draftEmergency) ?? 0;
      const surplus = parseNum(draftSurplus) ?? 0;
      if (draftSurplus.trim() === "") {
        setError("Enter your monthly surplus (use 0 if none).");
        return;
      }
      const next = { ...input, emergencyFund: ef, monthlySurplus: surplus };
      setInput(next);
      setAssessment(buildDebtStructuredAssessment(next));
      return;
    }

    const balance = parseNum(draftBalance) ?? 0;
    const rate = parseNum(draftRate) ?? 0;
    if (balance > 0 && rate <= 0) {
      setError("Enter an interest rate for this balance, or set balance to 0.");
      return;
    }
    if (rate < 0 || rate > 100) {
      setError("Interest rate should be between 0 and 100.");
      return;
    }

    const key = step.fields[0].key as keyof Pick<
      DebtAssessmentInput,
      "creditCard" | "personalLoan" | "autoLoan" | "studentLoan" | "mortgage"
    >;
    const next = {
      ...input,
      [key]: { balance, interestRatePct: rate },
    };
    setInput(next);

    if (stepIndex < STEPS.length - 1) {
      setStepIndex((s) => s + 1);
    }
  }

  function handleBack() {
    if (assessment) {
      setAssessment(null);
      return;
    }
    if (stepIndex === 0) {
      onBack();
      return;
    }
    setStepIndex((s) => s - 1);
  }

  if (assessment) {
    return (
      <AssessmentView
        assessment={assessment}
        theme={DEBT_THEME}
        onExploreRules={onExploreRules}
        onUpdateNumbers={() => {
          setAssessment(null);
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
            className={`h-full rounded-full ${DEBT_THEME.shell.headerGradient}`}
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

      {isDebtStep ? (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Balance ($)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={draftBalance}
              onChange={(e) => setDraftBalance(e.target.value)}
              placeholder="0"
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
              value={draftRate}
              onChange={(e) => setDraftRate(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-[15px] shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20"
            />
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Emergency fund ($)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={draftEmergency}
              onChange={(e) => setDraftEmergency(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-[15px] shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20"
            />
            <p className="mt-1 text-xs text-slate-500">
              Starter target ~$
              {debtSpec.constants.starter_emergency_fund_target.toLocaleString()}
            </p>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Monthly surplus ($)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={draftSurplus}
              onChange={(e) => setDraftSurplus(e.target.value)}
              placeholder="e.g. 500"
              className="w-full rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-[15px] shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20"
            />
            <p className="mt-1 text-xs text-slate-500">
              Income minus all expenses. Use a negative number if spending exceeds income.
            </p>
          </label>
        </div>
      )}

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
          {stepIndex === 0 ? "All sections" : "Back"}
        </button>
        <button
          type="button"
          onClick={handleNext}
          className={`rounded-xl px-5 py-3 text-sm font-bold text-white ${DEBT_THEME.chat.sendBtn}`}
        >
          {step.id === "cash-flow" ? "See my assessment" : "Continue"}
        </button>
      </div>
    </div>
  );
}
