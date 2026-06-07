import type { CarLoanConversationState } from "@/lib/car-loan-flow";
import type { ConversationState } from "@/lib/conversation";
import type {
  CarLoanFormValues,
  InvestmentFormValues,
  MortgageFormValues,
} from "@/lib/form-types";
import type { MortgageConversationState } from "@/lib/mortgage-flow";

export function carFormFromState(
  state: CarLoanConversationState | null | undefined
): Partial<CarLoanFormValues> | null {
  if (!state?.data) return null;
  const d = state.data;
  if (d.vehiclePrice === null) return null;
  return {
    vehiclePrice: d.vehiclePrice,
    downPayment: d.downPayment ?? 0,
    loanTermMonths: d.loanTermMonths ?? 48,
    grossMonthlyIncome: d.grossMonthlyIncome ?? 0,
    annualInterestRatePct: d.annualInterestRatePct ?? 0,
    monthlyInsurance: d.monthlyInsurance ?? 0,
    fuelType: d.isEv ? "ev" : "gas",
    monthlyFuel: d.monthlyFuel ?? 0,
  };
}

export function mortgageFormFromState(
  state: MortgageConversationState | null | undefined
): Partial<MortgageFormValues> | null {
  if (!state?.data) return null;
  const d = state.data;
  if (d.isRefinance) {
    if (d.currentRatePct === null) return null;
    return {
      scenario: "refinance",
      currentRatePct: d.currentRatePct,
      newRatePct: d.newRatePct ?? 0,
      loanTermYears: (d.loanTermYears === 15 ? 15 : 30) as 15 | 30,
    };
  }
  if (d.homePrice === null) return null;
  const required =
    (d.downPayment ?? 0) +
    (d.closingCosts ?? 0) +
    (d.emergencyFund ?? 0);
  const cashReady =
    d.cashAvailable !== null && required > 0 && d.cashAvailable >= required
      ? "yes"
      : "no";
  return {
    scenario: "purchase",
    homePrice: d.homePrice,
    grossMonthlyIncome: d.grossMonthlyIncome ?? 0,
    downPayment: d.downPayment ?? 0,
    emergencyFund: d.emergencyFund ?? 0,
    closingCosts: d.closingCosts,
    cashReady,
    cashAvailable: d.cashAvailable,
    interestRatePct: d.interestRatePct ?? 0,
    loanTermYears: (d.loanTermYears === 15 ? 15 : 30) as 15 | 30,
    monthlyPropertyTax: d.monthlyPropertyTax ?? 0,
    monthlyInsurance: d.monthlyInsurance ?? 0,
    monthlyHoaMaintenance: d.monthlyHoaMaintenance,
  };
}

export function investmentFormFromState(
  state: ConversationState | null | undefined
): Partial<InvestmentFormValues> | null {
  if (!state?.data) return null;
  const d = state.data;
  if (d.has401kMatch === null) return null;
  return {
    investAmount: d.investAmount,
    has401kMatch: d.has401kMatch,
    hasStarterEmergencyFund: d.hasStarterEmergencyFund ?? false,
    hasHighInterestDebt: d.hasHighInterestDebt ?? false,
    hasFullEmergencyFund: d.hasFullEmergencyFund ?? false,
    hsaEligible: d.hsaEligible ?? false,
    hasRothIra: d.hasRothIra ?? false,
    maxing401k: d.maxing401k ?? false,
  };
}
