"use client";

import { GuidedStepShell } from "@/components/guided/GuidedStepShell";
import { parseNum } from "@/components/guided/parse-amount";
import { useGuidedFormErrors } from "@/components/guided/useGuidedFormErrors";
import {
  useSanityAck,
  type GuidedSubmitOptions,
} from "@/components/guided/useSanityAck";
import type { MortgageFormValues } from "@/lib/form-types";
import {
  validateMortgageForm,
  validateMortgageHomePriceField,
} from "@/lib/form-sanity";
import {
  buildMortgagePurchasePayload,
  mortgageGuidedStepForError,
  validateMortgageGuidedStep,
} from "@/lib/guided-sanity";
import { mortgageFormFromState } from "@/lib/form-from-state";
import type { MortgageConversationState } from "@/lib/mortgage-flow";
import { INTAKE_INPUT } from "@/lib/section-theme";
import { useEffect, useMemo, useState } from "react";

type Scenario = "purchase" | "refinance";

type StepKind =
  | "scenario"
  | "home_price"
  | "gross_income"
  | "down_payment"
  | "emergency_fund"
  | "closing_costs"
  | "cash_ready"
  | "cash_available"
  | "interest_rate"
  | "loan_term"
  | "property_tax"
  | "insurance"
  | "hoa"
  | "current_rate"
  | "new_rate";

function buildSteps(scenario: Scenario, cashReady: "" | "yes" | "no"): StepKind[] {
  if (scenario === "refinance") {
    return ["scenario", "current_rate", "new_rate", "loan_term"];
  }
  const steps: StepKind[] = [
    "scenario",
    "home_price",
    "gross_income",
    "down_payment",
    "emergency_fund",
    "closing_costs",
    "cash_ready",
  ];
  if (cashReady === "no") steps.push("cash_available");
  steps.push(
    "interest_rate",
    "loan_term",
    "property_tax",
    "insurance",
    "hoa"
  );
  return steps;
}

const TITLES: Record<StepKind, string> = {
  scenario: "Are you buying a home or refinancing?",
  home_price: "What's the home purchase price?",
  gross_income: "What's your gross monthly income?",
  down_payment: "How much is your down payment?",
  emergency_fund: "How much is set aside for emergencies?",
  closing_costs: "Estimated closing costs (optional)",
  cash_ready:
    "Do you have enough cash for down payment, closing, and emergency fund?",
  cash_available: "How much cash do you have available?",
  interest_rate: "What mortgage interest rate are you using?",
  loan_term: "15-year or 30-year loan?",
  property_tax: "Monthly property tax",
  insurance: "Monthly homeowners insurance",
  hoa: "Monthly HOA or maintenance (optional)",
  current_rate: "What's your current mortgage rate?",
  new_rate: "What's the new rate you're considering?",
};

export function MortgageGuidedFlow({
  chatState,
  onSubmit,
  loading,
  externalError,
  onClearExternalError,
}: {
  chatState: unknown;
  onSubmit: (form: MortgageFormValues, options?: GuidedSubmitOptions) => void;
  loading: boolean;
  externalError?: string | null;
  onClearExternalError?: () => void;
}) {
  const initial = mortgageFormFromState(chatState as MortgageConversationState | null);
  const [step, setStep] = useState(0);
  const [scenario, setScenario] = useState<Scenario>(() => {
    if (initial && "scenario" in initial && initial.scenario) return initial.scenario;
    return "purchase";
  });
  const [homePrice, setHomePrice] = useState(
    initial && "homePrice" in initial ? String(initial.homePrice ?? "") : ""
  );
  const [grossMonthlyIncome, setGrossMonthlyIncome] = useState(
    initial && "grossMonthlyIncome" in initial
      ? String(initial.grossMonthlyIncome ?? "")
      : ""
  );
  const [downPayment, setDownPayment] = useState(
    initial && "downPayment" in initial ? String(initial.downPayment ?? "") : ""
  );
  const [emergencyFund, setEmergencyFund] = useState(
    initial && "emergencyFund" in initial ? String(initial.emergencyFund ?? "") : ""
  );
  const [closingCosts, setClosingCosts] = useState(
    initial && "closingCosts" in initial && initial.closingCosts != null
      ? String(initial.closingCosts)
      : ""
  );
  const [cashReady, setCashReady] = useState<"" | "yes" | "no">(() => {
    if (initial && "cashReady" in initial && initial.cashReady) return initial.cashReady;
    return "";
  });
  const [cashAvailable, setCashAvailable] = useState(
    initial && "cashAvailable" in initial && initial.cashAvailable != null
      ? String(initial.cashAvailable)
      : ""
  );
  const [interestRatePct, setInterestRatePct] = useState(
    initial && "interestRatePct" in initial ? String(initial.interestRatePct ?? "") : ""
  );
  const [loanTermYears, setLoanTermYears] = useState<15 | 30>(() => {
    if (initial && "loanTermYears" in initial && initial.loanTermYears) {
      return initial.loanTermYears;
    }
    return 30;
  });
  const [monthlyPropertyTax, setMonthlyPropertyTax] = useState(
    initial && "monthlyPropertyTax" in initial
      ? String(initial.monthlyPropertyTax ?? "")
      : ""
  );
  const [monthlyInsurance, setMonthlyInsurance] = useState(
    initial && "monthlyInsurance" in initial
      ? String(initial.monthlyInsurance ?? "")
      : ""
  );
  const [monthlyHoa, setMonthlyHoa] = useState(
    initial && "monthlyHoaMaintenance" in initial && initial.monthlyHoaMaintenance != null
      ? String(initial.monthlyHoaMaintenance)
      : ""
  );
  const [currentRatePct, setCurrentRatePct] = useState(
    initial && "currentRatePct" in initial ? String(initial.currentRatePct ?? "") : ""
  );
  const [newRatePct, setNewRatePct] = useState(
    initial && "newRatePct" in initial ? String(initial.newRatePct ?? "") : ""
  );

  const { displayError, setError, dismissErrors } = useGuidedFormErrors(
    externalError,
    onClearExternalError
  );
  const { warnOrProceed, resetAll } = useSanityAck();

  function dismissAll() {
    dismissErrors();
    resetAll();
  }

  const wrapChange =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      dismissAll();
      setter(v);
    };

  const steps = useMemo(() => buildSteps(scenario, cashReady), [scenario, cashReady]);

  useEffect(() => {
    setStep(0);
  }, [scenario]);

  useEffect(() => {
    setStep((s) => Math.min(s, Math.max(0, steps.length - 1)));
  }, [steps.length]);

  const kind = steps[step] ?? steps[0];

  function getPurchasePayload() {
    return buildMortgagePurchasePayload(
      {
        homePrice,
        grossMonthlyIncome,
        downPayment,
        emergencyFund,
        closingCosts,
        cashReady,
        cashAvailable,
        interestRatePct,
        loanTermYears,
        monthlyPropertyTax,
        monthlyInsurance,
        monthlyHoa,
      },
      parseNum
    );
  }

  /**
   * Soft plausibility warnings: warn once, then proceed on the next Continue.
   * We intentionally stay on the current (final) step instead of jumping to the
   * field the message mentions — jumping away would reset the two-click
   * acknowledgment and prevent the user from ever reaching the assessment.
   */
  function handleSanity(message: string, onProceed: () => void) {
    if (warnOrProceed(message, setError)) {
      return;
    }
    setError(null);
    onProceed();
  }

  function goNext() {
    onClearExternalError?.();
    if (kind === "scenario") {
      setStep((s) => s + 1);
      return;
    }
    if (kind === "home_price") {
      const hp = parseNum(homePrice);
      if (hp === null) {
        setError("Enter a valid home price.");
        return;
      }
      const priceSanity = validateMortgageHomePriceField(hp);
      if (!priceSanity.ok) {
        setError(priceSanity.message);
        return;
      }
    }
    if (kind === "gross_income") {
      if (parseNum(grossMonthlyIncome) === null) {
        setError("Enter gross monthly income.");
        return;
      }
    }
    if (kind === "down_payment") {
      if (parseNum(downPayment) === null) {
        setError("Enter down payment.");
        return;
      }
    }
    if (kind === "emergency_fund") {
      if (parseNum(emergencyFund) === null) {
        setError("Enter emergency fund amount.");
        return;
      }
    }
    if (kind === "closing_costs") {
      if (closingCosts.trim() && parseNum(closingCosts) === null) {
        setError("Enter a valid number or leave blank.");
        return;
      }
    }
    if (kind === "cash_ready") {
      if (!cashReady) {
        setError("Choose yes or no.");
        return;
      }
      setStep((s) => s + 1);
      return;
    }
    if (kind === "cash_available") {
      if (parseNum(cashAvailable) === null) {
        setError("Enter cash available.");
        return;
      }
    }
    if (kind === "interest_rate") {
      const r = parseNum(interestRatePct);
      if (r === null || r <= 0) {
        setError("Enter interest rate.");
        return;
      }
    }
    if (kind === "property_tax") {
      if (parseNum(monthlyPropertyTax) === null) {
        setError("Enter monthly property tax.");
        return;
      }
    }
    if (kind === "insurance") {
      if (parseNum(monthlyInsurance) === null) {
        setError("Enter monthly insurance.");
        return;
      }
      const payload = getPurchasePayload();
      const stepSanity = validateMortgageGuidedStep("insurance", payload);
      if (!stepSanity.ok) {
        // Mid-flow only catches HARD rejects — block and send the user to fix it.
        setError(stepSanity.message);
        const target = mortgageGuidedStepForError(stepSanity.message, steps);
        if (target !== step) setStep(() => target);
        return;
      }
    }
    if (kind === "hoa") {
      if (monthlyHoa.trim() && parseNum(monthlyHoa) === null) {
        setError("Enter a valid HOA amount or leave blank.");
        return;
      }
    }
    if (kind === "current_rate") {
      if (parseNum(currentRatePct) === null) {
        setError("Enter current rate.");
        return;
      }
    }
    if (kind === "new_rate") {
      if (parseNum(newRatePct) === null) {
        setError("Enter new rate.");
        return;
      }
    }

    if (step >= steps.length - 1) {
      if (scenario === "refinance") {
        const cur = parseNum(currentRatePct);
        const neu = parseNum(newRatePct);
        if (cur === null || neu === null) {
          setError("Check your rates.");
          return;
        }
        const refiPayload = {
          scenario: "refinance" as const,
          currentRatePct: cur,
          newRatePct: neu,
          loanTermYears,
        };
        const refiSanity = validateMortgageForm(refiPayload);
        if (!refiSanity.ok) {
          if (refiSanity.severity === "hard") {
            setError(refiSanity.message);
            const target = mortgageGuidedStepForError(refiSanity.message, steps);
            if (target !== step) setStep(() => target);
            return;
          }
          handleSanity(refiSanity.message, () =>
            onSubmit(refiPayload, { sanityAcknowledged: true })
          );
          return;
        }
        onSubmit(refiPayload);
        return;
      }
      const payload = getPurchasePayload();
      if (!payload) {
        setError("Review earlier steps — something is missing.");
        return;
      }
      const purchaseSanity = validateMortgageForm(payload);
      if (!purchaseSanity.ok) {
        if (purchaseSanity.severity === "hard") {
          // Hard rejects (impossible/typo'd inputs) always block — never acknowledgeable.
          setError(purchaseSanity.message);
          const target = mortgageGuidedStepForError(purchaseSanity.message, steps);
          if (target !== step) setStep(() => target);
          return;
        }
        handleSanity(purchaseSanity.message, () =>
          onSubmit(payload, { sanityAcknowledged: true })
        );
        return;
      }
      onSubmit(payload);
      return;
    }
    setError(null);
    setStep((s) => s + 1);
  }

  function goBack() {
    dismissAll();
    setStep((s) => Math.max(0, s - 1));
  }

  return (
    <GuidedStepShell
      section="mortgage"
      stepIndex={step + 1}
      stepTotal={steps.length}
      stepId={kind}
      title={TITLES[kind]}
      subtitle={
        kind === "closing_costs"
          ? "Leave blank to estimate about 3% of the home price."
          : kind === "hoa"
            ? "Leave blank if you don't have HOA or planned maintenance."
            : kind === "insurance"
              ? "Use your actual quote — we won't estimate from home price."
              : undefined
      }
      error={displayError}
      onBack={step > 0 ? goBack : undefined}
      onNext={goNext}
      loading={loading}
      isFirst={step === 0}
      isLast={step === steps.length - 1}
    >
      {kind === "scenario" && (
        <div className="flex flex-col gap-3">
          {(
            [
              ["purchase", "Buying a home"],
              ["refinance", "Refinancing"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                dismissAll();
                setScenario(id);
              }}
              className={`rounded-xl border-2 px-4 py-4 text-left text-sm font-semibold transition ${
                scenario === id
                  ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {kind === "home_price" && (
        <input
          className={INTAKE_INPUT}
          value={homePrice}
          onChange={(e) => wrapChange(setHomePrice)(e.target.value)}
          placeholder="e.g. 500000 or 500k"
          autoFocus
        />
      )}
      {kind === "gross_income" && (
        <input
          className={INTAKE_INPUT}
          value={grossMonthlyIncome}
          onChange={(e) => wrapChange(setGrossMonthlyIncome)(e.target.value)}
          placeholder="e.g. 9000"
          autoFocus
        />
      )}
      {kind === "down_payment" && (
        <input
          className={INTAKE_INPUT}
          value={downPayment}
          onChange={(e) => wrapChange(setDownPayment)(e.target.value)}
          placeholder="e.g. 100000"
          autoFocus
        />
      )}
      {kind === "emergency_fund" && (
        <input
          className={INTAKE_INPUT}
          value={emergencyFund}
          onChange={(e) => wrapChange(setEmergencyFund)(e.target.value)}
          placeholder="e.g. 15000"
          autoFocus
        />
      )}
      {kind === "closing_costs" && (
        <input
          className={INTAKE_INPUT}
          value={closingCosts}
          onChange={(e) => wrapChange(setClosingCosts)(e.target.value)}
          placeholder="Optional"
          autoFocus
        />
      )}
      {kind === "cash_ready" && (
        <select
          className={INTAKE_INPUT}
          value={cashReady}
          onChange={(e) => {
            dismissErrors();
            setCashReady(e.target.value as "yes" | "no");
          }}
        >
          <option value="">Select…</option>
          <option value="yes">Yes — saved, not borrowed</option>
          <option value="no">Not yet / only part</option>
        </select>
      )}
      {kind === "cash_available" && (
        <input
          className={INTAKE_INPUT}
          value={cashAvailable}
          onChange={(e) => wrapChange(setCashAvailable)(e.target.value)}
          autoFocus
        />
      )}
      {kind === "interest_rate" && (
        <input
          className={INTAKE_INPUT}
          value={interestRatePct}
          onChange={(e) => wrapChange(setInterestRatePct)(e.target.value)}
          placeholder="e.g. 6.5"
          autoFocus
        />
      )}
      {kind === "loan_term" && (
        <select
          className={INTAKE_INPUT}
          value={loanTermYears}
          onChange={(e) => {
            dismissAll();
            setLoanTermYears(Number(e.target.value) as 15 | 30);
          }}
        >
          <option value={15}>15 years</option>
          <option value={30}>30 years</option>
        </select>
      )}
      {kind === "property_tax" && (
        <input
          className={INTAKE_INPUT}
          value={monthlyPropertyTax}
          onChange={(e) => wrapChange(setMonthlyPropertyTax)(e.target.value)}
          autoFocus
        />
      )}
      {kind === "insurance" && (
        <input
          className={INTAKE_INPUT}
          value={monthlyInsurance}
          onChange={(e) => wrapChange(setMonthlyInsurance)(e.target.value)}
          autoFocus
        />
      )}
      {kind === "hoa" && (
        <input
          className={INTAKE_INPUT}
          value={monthlyHoa}
          onChange={(e) => wrapChange(setMonthlyHoa)(e.target.value)}
          placeholder="Optional"
          autoFocus
        />
      )}
      {kind === "current_rate" && (
        <input
          className={INTAKE_INPUT}
          value={currentRatePct}
          onChange={(e) => wrapChange(setCurrentRatePct)(e.target.value)}
          autoFocus
        />
      )}
      {kind === "new_rate" && (
        <input
          className={INTAKE_INPUT}
          value={newRatePct}
          onChange={(e) => wrapChange(setNewRatePct)(e.target.value)}
          autoFocus
        />
      )}
    </GuidedStepShell>
  );
}
