/** Shared types for YAML specs (car.yaml, mortgage.yaml, investment.yaml). */

export type IntakeFieldSpec = {
  stage?: string;
  question: string;
};

export type CarSpec = {
  id: "car-loan";
  meta: { label: string; blurb: string; hub_intro: string };
  intake: {
    policy: string[];
    field_order: string[];
  };
  fields: Record<string, IntakeFieldSpec>;
  rules: {
    min_down_payment_pct: number;
    max_loan_term_months: number;
    max_loan_term_years: number;
    max_transport_pct_of_gross: number;
    max_apr_pct: number;
    no_term_exceptions: boolean;
  };
  transport: { components: string[]; excluded: string[] };
  loan_payment: { method: string; inputs: string[] };
  rules_summary: string;
  direct_answers: Record<string, string>;
  assessment: Record<string, string>;
};

export type MortgageSpec = {
  id: "mortgage";
  meta: { label: string; blurb: string; hub_intro: string };
  intake: {
    policy: string[];
    purchase_field_order: string[];
    refinance_field_order: string[];
  };
  fields: Record<string, IntakeFieldSpec>;
  rules: {
    min_down_payment_pct: number;
    preferred_loan_terms_years: number[];
    refinance_rate_drop_min_pct: number;
    high_rate_extra_payoff_pct: number;
    max_housing_pct_of_gross: number;
    hidden_cost_pct_low: number;
    hidden_cost_pct_high: number;
    hidden_cost_pct_default: number;
    estimated_closing_cost_pct: number;
    require_emergency_fund_before_buy: boolean;
    rent_if_not_ready: boolean;
  };
  readiness: { required_cash_components: string[] };
  rules_summary: string;
  direct_answers: Record<string, string>;
  assessment: Record<string, string>;
};

export type InvestmentPriorityStep = {
  step: number;
  key: string;
  summary: string;
};

export type InvestmentSpec = {
  id: "investment";
  meta: { label: string; blurb: string; hub_intro: string };
  intake: { policy: string[] };
  constants: {
    starter_emergency_fund_target: number;
    full_emergency_months_min: number;
  };
  priority_order: InvestmentPriorityStep[];
  questions: Record<string, IntakeFieldSpec & { stage: string }>;
  rules_summary: string;
  direct_answers: Record<string, string>;
  messages: Record<string, string>;
};

export type SectionId = CarSpec["id"] | MortgageSpec["id"] | InvestmentSpec["id"];
