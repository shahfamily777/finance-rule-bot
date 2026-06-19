import type { FormSanityResult } from "@/lib/form-sanity";
import {
  validateCarLoanForm,
  validateCarLoanInsuranceField,
  validateInvestmentForm,
  validateMortgageFormHard,
} from "@/lib/form-sanity";
import type {
  CarLoanFormValues,
  InvestmentFormValues,
  MortgageFormValues,
} from "@/lib/form-types";

/** Map a full-form sanity message to the guided step index (0-based). */
export function carLoanGuidedStepForError(message: string): number {
  const m = message.toLowerCase();
  if (/insurance/.test(m)) return 5;
  if (/fuel|charging|\bgas\b/.test(m)) return 6;
  if (/down payment/.test(m)) return 1;
  if (/income/.test(m)) return 3;
  if (/apr|interest rate/.test(m)) return 4;
  if (/term/.test(m)) return 2;
  if (/vehicle price|car price/.test(m)) return 0;
  if (/payment|transport/.test(m)) return 6;
  return 6;
}

export function mortgageGuidedStepForError(
  message: string,
  steps: string[]
): number {
  const m = message.toLowerCase();
  const idx = (kind: string) => {
    const i = steps.indexOf(kind);
    return i >= 0 ? i : steps.length - 1;
  };
  if (/insurance/.test(m)) return idx("insurance");
  if (/property tax|\btax\b/.test(m)) return idx("property_tax");
  if (/hoa|maintenance/.test(m)) return idx("hoa");
  if (/down payment/.test(m)) return idx("down_payment");
  if (/income/.test(m)) return idx("gross_income");
  if (/closing/.test(m)) return idx("closing_costs");
  if (/emergency fund/.test(m)) return idx("emergency_fund");
  if (/cash/.test(m)) return idx("cash_available");
  if (/rate|refinanc/.test(m)) {
    if (/current/.test(m)) return idx("current_rate");
    if (/new/.test(m)) return idx("new_rate");
    return idx("interest_rate");
  }
  if (/home price|purchase price/.test(m)) return idx("home_price");
  if (/housing|afford/.test(m)) return idx("insurance");
  return steps.length - 1;
}

export function investmentGuidedStepForError(message: string): number {
  const m = message.toLowerCase();
  if (/investment amount|invest amount/.test(m)) return 0;
  if (/401|match/.test(m)) return 1;
  if (/starter/.test(m)) return 2;
  if (/debt/.test(m)) return 3;
  if (/full emergency/.test(m)) return 4;
  return 0;
}

export function applySanityFailure(
  message: string,
  setError: (msg: string) => void,
  setStep: (fn: (s: number) => number) => void,
  stepForError: number,
  currentStep: number
): void {
  setError(message);
  if (stepForError !== currentStep) {
    setStep(() => stepForError);
  }
}

export function validateCarLoanGuidedStep(
  step: number,
  v: Partial<CarLoanFormValues>
): FormSanityResult {
  if (
    step === 5 &&
    v.vehiclePrice != null &&
    v.grossMonthlyIncome != null &&
    v.monthlyInsurance != null
  ) {
    return validateCarLoanInsuranceField(
      v.vehiclePrice,
      v.grossMonthlyIncome,
      v.monthlyInsurance
    );
  }
  if (
    step >= 6 &&
    v.vehiclePrice != null &&
    v.downPayment != null &&
    v.loanTermMonths != null &&
    v.grossMonthlyIncome != null &&
    v.annualInterestRatePct != null &&
    v.monthlyInsurance != null &&
    v.fuelType != null &&
    v.monthlyFuel != null
  ) {
    return validateCarLoanForm(v as CarLoanFormValues);
  }
  return { ok: true };
}

export function buildMortgagePurchasePayload(
  fields: {
    homePrice: string;
    grossMonthlyIncome: string;
    downPayment: string;
    emergencyFund: string;
    closingCosts: string;
    cashReady: "" | "yes" | "no";
    cashAvailable: string;
    interestRatePct: string;
    loanTermYears: 15 | 30;
    monthlyPropertyTax: string;
    monthlyInsurance: string;
    monthlyHoa: string;
  },
  parseNum: (raw: string) => number | null
): Extract<MortgageFormValues, { scenario: "purchase" }> | null {
  const hp = parseNum(fields.homePrice);
  const income = parseNum(fields.grossMonthlyIncome);
  const down = parseNum(fields.downPayment);
  const ef = parseNum(fields.emergencyFund);
  const rate = parseNum(fields.interestRatePct);
  const tax = parseNum(fields.monthlyPropertyTax);
  const ins = parseNum(fields.monthlyInsurance);
  const hoaRaw = fields.monthlyHoa.trim();
  const hoa = hoaRaw ? parseNum(hoaRaw) : null;
  if (
    hp === null ||
    income === null ||
    down === null ||
    ef === null ||
    rate === null ||
    tax === null ||
    ins === null
  ) {
    return null;
  }
  if (!fields.cashReady) return null;
  let cashAmt: number | null = null;
  if (fields.cashReady === "no") {
    cashAmt = parseNum(fields.cashAvailable);
    if (cashAmt === null) return null;
  }
  return {
    scenario: "purchase",
    homePrice: hp,
    grossMonthlyIncome: income,
    downPayment: down,
    emergencyFund: ef,
    closingCosts: fields.closingCosts.trim() ? parseNum(fields.closingCosts) : null,
    cashReady: fields.cashReady,
    cashAvailable: cashAmt,
    interestRatePct: rate,
    loanTermYears: fields.loanTermYears,
    monthlyPropertyTax: tax,
    monthlyInsurance: ins,
    monthlyHoaMaintenance: hoaRaw ? hoa : null,
  };
}

/**
 * Mid-flow (per-step) validation only surfaces HARD rejects so the user is sent
 * back to fix impossible inputs early. Soft plausibility warnings are deferred to
 * the final submit, where they can be acknowledged and proceed to the assessment.
 */
export function validateMortgageGuidedStep(
  stepKind: string,
  payload: MortgageFormValues | null
): FormSanityResult {
  if (!payload) return { ok: true };
  if (stepKind === "property_tax" && payload.scenario === "purchase") {
    if (payload.monthlyPropertyTax == null || payload.homePrice == null) return { ok: true };
    return validateMortgageFormHard(payload);
  }
  if (stepKind === "insurance" && payload.scenario === "purchase") {
    if (payload.monthlyInsurance == null) return { ok: true };
    return validateMortgageFormHard(payload);
  }
  return { ok: true };
}

export function validateInvestmentGuidedStep(
  stepId: string,
  investAmount: number | null,
  partial: Partial<InvestmentFormValues>
): FormSanityResult {
  if (stepId !== "invest_amount" || investAmount === null) return { ok: true };
  return validateInvestmentForm({
    investAmount,
    has401kMatch: partial.has401kMatch ?? false,
    hasStarterEmergencyFund: partial.hasStarterEmergencyFund ?? false,
    hasHighInterestDebt: partial.hasHighInterestDebt ?? false,
    hasFullEmergencyFund: partial.hasFullEmergencyFund ?? false,
    hsaEligible: partial.hsaEligible ?? false,
    hasRothIra: partial.hasRothIra ?? false,
    maxing401k: partial.maxing401k ?? false,
  });
}
