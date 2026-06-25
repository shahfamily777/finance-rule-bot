import { carSpec, investmentSpec, mortgageSpec, platformSpec } from "./bundle";

export {
  carSpec,
  mortgageSpec,
  investmentSpec,
  debtSpec,
  platformSpec,
  aiBehaviorSpec,
  costlyMistakesSpec,
  HUB_SECTIONS,
  INTAKE_POLICY_UNIVERSAL,
} from "./bundle";
export type {
  CarSpec,
  MortgageSpec,
  InvestmentSpec,
  DebtSpec,
  SectionId,
  AiBehaviorSpec,
  CostlyMistakesSpec,
  CostlyMistakeTopic,
  CostlyMistakeQuestion,
  CostlyMistakeQuestionOption,
} from "./types";
export {
  formatSpecTemplate,
  carTemplateVars,
  mortgageTemplateVars,
} from "./format";

/** Legacy-shaped mortgage rules object (from mortgage.yaml). */
export function getMortgageRulesFromSpec() {
  const r = mortgageSpec.rules;
  return {
    MIN_DOWN_PAYMENT_PCT: r.min_down_payment_pct,
    PREFERRED_LOAN_TERMS_YEARS: r.preferred_loan_terms_years,
    REFINANCE_RATE_DROP_MIN_PCT: r.refinance_rate_drop_min_pct,
    HIGH_RATE_EXTRA_PAYOFF_PCT: r.high_rate_extra_payoff_pct,
    MAX_HOUSING_PCT_OF_GROSS_INCOME: r.max_housing_pct_of_gross,
    HIDDEN_COST_PCT_LOW: r.hidden_cost_pct_low,
    HIDDEN_COST_PCT_HIGH: r.hidden_cost_pct_high,
    HIDDEN_COST_PCT_DEFAULT: r.hidden_cost_pct_default,
    ESTIMATED_CLOSING_COST_PCT: r.estimated_closing_cost_pct,
  } as const;
}
