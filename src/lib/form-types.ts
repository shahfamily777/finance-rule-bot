export type CarLoanFormValues = {
  vehiclePrice: number;
  downPayment: number;
  loanTermMonths: number;
  grossMonthlyIncome: number;
  annualInterestRatePct: number;
  monthlyInsurance: number;
  fuelType: "gas" | "ev";
  monthlyFuel: number;
};

export type MortgageScenario = "purchase" | "refinance";

export type MortgagePurchaseFormValues = {
  scenario: "purchase";
  homePrice: number;
  grossMonthlyIncome: number;
  downPayment: number;
  emergencyFund: number;
  closingCosts: number | null;
  cashReady: "yes" | "no";
  cashAvailable: number | null;
  interestRatePct: number;
  loanTermYears: 15 | 30;
  monthlyPropertyTax: number;
  monthlyInsurance: number;
  /** Optional — $0 if none */
  monthlyHoaMaintenance: number | null;
};

export type MortgageRefinanceFormValues = {
  scenario: "refinance";
  currentRatePct: number;
  newRatePct: number;
  loanTermYears: 15 | 30;
};

export type MortgageFormValues =
  | MortgagePurchaseFormValues
  | MortgageRefinanceFormValues;

export type InvestmentFormValues = {
  investAmount: number | null;
  has401kMatch: boolean;
  hasStarterEmergencyFund: boolean;
  hasHighInterestDebt: boolean;
  hasFullEmergencyFund: boolean;
  hsaEligible: boolean;
  hasRothIra: boolean;
  maxing401k: boolean;
};
