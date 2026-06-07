"use client";

import type { CarLoanConversationState } from "@/lib/car-loan-flow";
import type { ConversationState } from "@/lib/conversation";
import {
  carFormFromState,
  investmentFormFromState,
  mortgageFormFromState,
} from "@/lib/form-from-state";
import type {
  CarLoanFormValues,
  InvestmentFormValues,
  MortgageFormValues,
} from "@/lib/form-types";
import type { MortgageConversationState } from "@/lib/mortgage-flow";
import { FormThemeProvider } from "@/components/FormThemeContext";
import {
  FormError,
  IntakeField,
  IntakeMoneyInput,
  IntakeSubmit,
} from "@/components/intake-fields";
import {
  InvestmentIntakeForm,
  MortgageIntakeForm,
} from "@/components/MortgageInvestmentIntake";
import {
  validateCarLoanForm,
  validateInvestmentForm,
  validateMortgageForm,
} from "@/lib/form-sanity";
import { getSectionTheme, INTAKE_INPUT } from "@/lib/section-theme";
import { useMemo, useState } from "react";

export type SectionId = "car-loan" | "mortgage" | "investment";

function parseNum(raw: string): number | null {
  const t = raw.replace(/,/g, "").trim();
  if (!t) return null;
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(k|m)?$/i);
  if (!m) {
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  let n = Number(m[1]);
  const s = (m[2] || "").toLowerCase();
  if (s === "k") n *= 1000;
  if (s === "m") n *= 1_000_000;
  return Number.isFinite(n) ? n : null;
}

function CarLoanForm({
  initial,
  onSubmit,
  loading,
}: {
  initial: Partial<CarLoanFormValues> | null;
  onSubmit: (form: CarLoanFormValues) => void;
  loading: boolean;
}) {
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
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const vp = parseNum(vehiclePrice);
    const dp = parseNum(downPayment);
    const term = parseNum(loanTermMonths);
    const income = parseNum(grossMonthlyIncome);
    const rate = parseNum(apr);
    const ins = parseNum(insurance);
    const fuel = parseNum(monthlyFuel);
    if (
      vp === null ||
      dp === null ||
      term === null ||
      income === null ||
      rate === null ||
      ins === null ||
      fuel === null
    ) {
      setError("Please fill in every field with a valid number.");
      return;
    }
    if (term > 48) {
      setError("Loan term cannot exceed 48 months.");
      return;
    }
    if (dp > vp) {
      setError("Down payment cannot be more than the vehicle price.");
      return;
    }
    const payload = {
      vehiclePrice: vp,
      downPayment: dp,
      loanTermMonths: term,
      grossMonthlyIncome: income,
      annualInterestRatePct: rate,
      monthlyInsurance: ins,
      fuelType,
      monthlyFuel: fuel,
    };
    const sanity = validateCarLoanForm(payload);
    if (!sanity.ok) {
      setError(sanity.message);
      return;
    }
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <IntakeMoneyInput
        id="vehiclePrice"
        label="Vehicle purchase price"
        value={vehiclePrice}
        onChange={setVehiclePrice}
      />
      <IntakeMoneyInput
        id="downPayment"
        label="Down payment (cash)"
        value={downPayment}
        onChange={setDownPayment}
        hint="Target at least 20% of the vehicle price."
      />
      <IntakeField id="loanTermMonths" label="Loan term (months)" hint="Maximum 48 months.">
        <input
          id="loanTermMonths"
          type="number"
          min={1}
          max={48}
          value={loanTermMonths}
          onChange={(e) => setLoanTermMonths(e.target.value)}
          className={INTAKE_INPUT}
          required
        />
      </IntakeField>
      <IntakeMoneyInput
        id="grossIncome"
        label="Gross monthly income (before taxes)"
        value={grossMonthlyIncome}
        onChange={setGrossMonthlyIncome}
      />
      <IntakeField id="apr" label="Loan APR (%)" hint="e.g. 6.5">
        <input
          id="apr"
          type="text"
          inputMode="decimal"
          placeholder="6.5"
          value={apr}
          onChange={(e) => setApr(e.target.value)}
          className={INTAKE_INPUT}
          required
        />
      </IntakeField>
      <IntakeMoneyInput
        id="insurance"
        label="Monthly auto insurance"
        value={insurance}
        onChange={setInsurance}
      />
      <IntakeField id="fuelType" label="Gas or EV charging">
        <select
          id="fuelType"
          value={fuelType}
          onChange={(e) => setFuelType(e.target.value as "gas" | "ev")}
          className={INTAKE_INPUT}
        >
          <option value="gas">Gas / fuel</option>
          <option value="ev">EV charging</option>
        </select>
      </IntakeField>
      <IntakeMoneyInput
        id="monthlyFuel"
        label={fuelType === "ev" ? "Monthly EV charging cost" : "Monthly gas / fuel"}
        value={monthlyFuel}
        onChange={setMonthlyFuel}
      />
      {error ? <FormError message={error} /> : null}
      <IntakeSubmit loading={loading}>
        {loading ? "Running checklist…" : "Get my car loan assessment"}
      </IntakeSubmit>
    </form>
  );
}

type SectionIntakeFormProps = {
  section: SectionId;
  chatState: unknown;
  sanityError?: string | null;
  onSubmit: (form: CarLoanFormValues | MortgageFormValues | InvestmentFormValues) => void;
  loading: boolean;
};

export function SectionIntakeForm({
  section,
  chatState,
  sanityError,
  onSubmit,
  loading,
}: SectionIntakeFormProps) {
  const initial = useMemo(() => {
    if (section === "car-loan") {
      return carFormFromState(chatState as CarLoanConversationState | null);
    }
    if (section === "mortgage") {
      return mortgageFormFromState(chatState as MortgageConversationState | null);
    }
    return investmentFormFromState(chatState as ConversationState | null);
  }, [section, chatState]);

  const theme = getSectionTheme(section);

  return (
    <FormThemeProvider section={section}>
      <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/75 shadow-xl shadow-slate-300/30 backdrop-blur-md">
        <div className={`${theme.shell.headerGradient} px-5 py-4 sm:px-6`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
            Step 1 · Your numbers
          </p>
          <h2 className="mt-1 text-lg font-bold text-white sm:text-xl">
            {theme.emoji} {theme.label} intake
          </h2>
          <p className="mt-1 text-sm text-white/85">
            Fill in the form — we&apos;ll run your checklist, then you can chat about the rules.
          </p>
        </div>
        <div className="p-5 sm:p-6">
        {sanityError ? <FormError message={sanityError} /> : null}
      {section === "car-loan" ? (
        <CarLoanForm
          initial={initial as Partial<CarLoanFormValues> | null}
          onSubmit={onSubmit as (f: CarLoanFormValues) => void}
          loading={loading}
        />
      ) : section === "mortgage" ? (
        <MortgageIntakeForm
          initial={initial as Partial<MortgageFormValues> | null}
          onSubmit={onSubmit as (f: MortgageFormValues) => void}
          loading={loading}
        />
      ) : (
        <InvestmentIntakeForm
          initial={initial as Partial<InvestmentFormValues> | null}
          onSubmit={onSubmit as (f: InvestmentFormValues) => void}
          loading={loading}
        />
      )}
        </div>
      </div>
    </FormThemeProvider>
  );
}
