"use client";

import { GuidedStepShell } from "@/components/guided/GuidedStepShell";
import { parseNum } from "@/components/guided/parse-amount";
import { useGuidedFormErrors } from "@/components/guided/useGuidedFormErrors";
import {
  useSanityAck,
  type GuidedSubmitOptions,
} from "@/components/guided/useSanityAck";
import { INTAKE_INPUT } from "@/lib/section-theme";
import type { CarLoanFormValues } from "@/lib/form-types";
import { carFormFromState } from "@/lib/form-from-state";
import type { CarLoanConversationState } from "@/lib/car-loan-flow";
import {
  carLoanGuidedStepForError,
  validateCarLoanGuidedStep,
} from "@/lib/guided-sanity";
import { useState } from "react";

const STEP_IDS = [
  "vehicle_price",
  "down_payment",
  "loan_term",
  "gross_income",
  "interest_rate",
  "insurance",
  "fuel",
] as const;

const TOTAL = STEP_IDS.length;

export function CarLoanGuidedFlow({
  chatState,
  onSubmit,
  loading,
  externalError,
  onClearExternalError,
}: {
  chatState: unknown;
  onSubmit: (form: CarLoanFormValues, options?: GuidedSubmitOptions) => void;
  loading: boolean;
  externalError?: string | null;
  onClearExternalError?: () => void;
}) {
  const initial = carFormFromState(chatState as CarLoanConversationState | null);
  const [step, setStep] = useState(0);
  const [vehiclePrice, setVehiclePrice] = useState(
    initial?.vehiclePrice?.toString() ?? ""
  );
  const [downPayment, setDownPayment] = useState(
    initial?.downPayment?.toString() ?? ""
  );
  const [loanTermMonths, setLoanTermMonths] = useState(
    initial?.loanTermMonths?.toString() ?? "48"
  );
  const [grossMonthlyIncome, setGrossMonthlyIncome] = useState(
    initial?.grossMonthlyIncome?.toString() ?? ""
  );
  const [apr, setApr] = useState(initial?.annualInterestRatePct?.toString() ?? "");
  const [insurance, setInsurance] = useState(
    initial?.monthlyInsurance?.toString() ?? ""
  );
  const [fuelType, setFuelType] = useState<"gas" | "ev">(initial?.fuelType ?? "gas");
  const [monthlyFuel, setMonthlyFuel] = useState(
    initial?.monthlyFuel?.toString() ?? ""
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

  const stepId = STEP_IDS[step];

  function parsedFields() {
    return {
      vehiclePrice: parseNum(vehiclePrice),
      downPayment: parseNum(downPayment),
      loanTermMonths: parseNum(loanTermMonths),
      grossMonthlyIncome: parseNum(grossMonthlyIncome),
      annualInterestRatePct: parseNum(apr),
      monthlyInsurance: parseNum(insurance),
      fuelType,
      monthlyFuel: parseNum(monthlyFuel),
    };
  }

  function handleSanity(message: string, onProceed: () => void) {
    if (warnOrProceed(message, setError)) {
      const target = carLoanGuidedStepForError(message);
      if (target !== step) {
        setStep(() => target);
      }
      return;
    }
    setError(null);
    onProceed();
  }

  function goNext() {
    onClearExternalError?.();
    const p = parsedFields();

    if (step === 0) {
      if (p.vehiclePrice === null || p.vehiclePrice <= 0) {
        setError("Enter a valid vehicle price.");
        return;
      }
    }
    if (step === 1) {
      if (p.downPayment === null || p.downPayment < 0) {
        setError("Enter your down payment amount.");
        return;
      }
      if (p.vehiclePrice !== null && p.downPayment > p.vehiclePrice) {
        setError("Down payment can't be more than the vehicle price.");
        return;
      }
    }
    if (step === 2) {
      if (p.loanTermMonths === null || p.loanTermMonths < 1 || p.loanTermMonths > 48) {
        setError("Enter a loan term between 1 and 48 months.");
        return;
      }
    }
    if (step === 3) {
      if (p.grossMonthlyIncome === null || p.grossMonthlyIncome <= 0) {
        setError("Enter your gross monthly income.");
        return;
      }
    }
    if (step === 4) {
      if (
        p.annualInterestRatePct === null ||
        p.annualInterestRatePct <= 0 ||
        p.annualInterestRatePct > 30
      ) {
        setError("Enter a realistic APR (e.g. 6.5).");
        return;
      }
    }
    if (step === 5) {
      if (p.monthlyInsurance === null || p.monthlyInsurance < 0) {
        setError("Enter your monthly insurance estimate.");
        return;
      }
      const stepSanity = validateCarLoanGuidedStep(5, {
        vehiclePrice: p.vehiclePrice ?? undefined,
        grossMonthlyIncome: p.grossMonthlyIncome ?? undefined,
        monthlyInsurance: p.monthlyInsurance,
      });
      if (!stepSanity.ok) {
        handleSanity(stepSanity.message, () => setStep((s) => s + 1));
        return;
      }
    }
    if (step === 6) {
      if (p.monthlyFuel === null || p.monthlyFuel < 0) {
        setError("Enter your monthly fuel or charging cost.");
        return;
      }
      if (
        p.vehiclePrice === null ||
        p.downPayment === null ||
        p.loanTermMonths === null ||
        p.grossMonthlyIncome === null ||
        p.annualInterestRatePct === null ||
        p.monthlyInsurance === null
      ) {
        setError("Something's missing — use Back to review earlier steps.");
        return;
      }
      const payload: CarLoanFormValues = {
        vehiclePrice: p.vehiclePrice,
        downPayment: p.downPayment,
        loanTermMonths: p.loanTermMonths,
        grossMonthlyIncome: p.grossMonthlyIncome,
        annualInterestRatePct: p.annualInterestRatePct,
        monthlyInsurance: p.monthlyInsurance,
        fuelType: p.fuelType,
        monthlyFuel: p.monthlyFuel,
      };
      const sanity = validateCarLoanGuidedStep(6, payload);
      if (!sanity.ok) {
        handleSanity(sanity.message, () =>
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

  const vpHint =
    parseNum(vehiclePrice) !== null
      ? `20% down target: about $${Math.ceil((parseNum(vehiclePrice) ?? 0) * 0.2).toLocaleString()}`
      : undefined;

  return (
    <GuidedStepShell
      section="car-loan"
      stepIndex={step + 1}
      stepTotal={TOTAL}
      stepId={stepId}
      title={
        step === 0
          ? "What's the vehicle purchase price?"
          : step === 1
            ? "How much will you put down?"
            : step === 2
              ? "What loan term are you considering?"
              : step === 3
                ? "What's your gross monthly income?"
                : step === 4
                  ? "What's the loan APR?"
                  : step === 5
                    ? "What's your monthly auto insurance?"
                    : "Gas or EV — and monthly cost?"
      }
      subtitle={
        step === 1
          ? vpHint
          : step === 2
            ? "Our rules cap car loans at 48 months (4 years)."
            : step === 3
              ? "Before taxes — same number you'd use for a lender."
              : step === 4
                ? "Annual percentage rate on the loan."
                : step === 6
                  ? "This counts toward your 10% transportation cap."
                  : undefined
      }
      error={displayError}
      onBack={step > 0 ? goBack : undefined}
      onNext={goNext}
      loading={loading}
      isFirst={step === 0}
      isLast={step === TOTAL - 1}
    >
      {step === 0 && (
        <input
          type="text"
          inputMode="decimal"
          placeholder="e.g. 32000 or 32k"
          value={vehiclePrice}
          onChange={(e) => wrapChange(setVehiclePrice)(e.target.value)}
          className={INTAKE_INPUT}
          autoFocus
        />
      )}
      {step === 1 && (
        <input
          type="text"
          inputMode="decimal"
          placeholder="e.g. 8000"
          value={downPayment}
          onChange={(e) => wrapChange(setDownPayment)(e.target.value)}
          className={INTAKE_INPUT}
          autoFocus
        />
      )}
      {step === 2 && (
        <input
          type="number"
          min={1}
          max={48}
          value={loanTermMonths}
          onChange={(e) => wrapChange(setLoanTermMonths)(e.target.value)}
          className={INTAKE_INPUT}
          autoFocus
        />
      )}
      {step === 3 && (
        <input
          type="text"
          inputMode="decimal"
          placeholder="e.g. 6500"
          value={grossMonthlyIncome}
          onChange={(e) => wrapChange(setGrossMonthlyIncome)(e.target.value)}
          className={INTAKE_INPUT}
          autoFocus
        />
      )}
      {step === 4 && (
        <input
          type="text"
          inputMode="decimal"
          placeholder="e.g. 6.5"
          value={apr}
          onChange={(e) => wrapChange(setApr)(e.target.value)}
          className={INTAKE_INPUT}
          autoFocus
        />
      )}
      {step === 5 && (
        <input
          type="text"
          inputMode="decimal"
          placeholder="e.g. 150"
          value={insurance}
          onChange={(e) => wrapChange(setInsurance)(e.target.value)}
          className={INTAKE_INPUT}
          autoFocus
        />
      )}
      {step === 6 && (
        <div className="space-y-4">
          <select
            value={fuelType}
            onChange={(e) => wrapChange(setFuelType)(e.target.value as "gas" | "ev")}
            className={INTAKE_INPUT}
          >
            <option value="gas">Gas / fuel</option>
            <option value="ev">EV charging</option>
          </select>
          <input
            type="text"
            inputMode="decimal"
            placeholder="e.g. 120"
            value={monthlyFuel}
            onChange={(e) => wrapChange(setMonthlyFuel)(e.target.value)}
            className={INTAKE_INPUT}
            autoFocus
          />
        </div>
      )}
    </GuidedStepShell>
  );
}
