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

export type DebtSection = {
  id: string;
  title: string;
  description: string;
};

export type DebtSpec = {
  id: "debt";
  meta: { label: string; blurb: string; hub_intro: string };
  constants: {
    starter_emergency_fund_target: number;
    high_interest_threshold_pct: number;
    low_interest_threshold_pct: number;
  };
  sections: DebtSection[];
  rules: {
    high_interest_debt_pct: number;
    debt_vs_invest_focus_debt_pct: number;
    debt_vs_invest_mixed_low_pct: number;
    debt_vs_invest_mixed_high_pct: number;
  };
  snowball_avalanche: {
    snowball: {
      name: string;
      description: string;
      benefits: string[];
      drawbacks: string[];
    };
    avalanche: {
      name: string;
      description: string;
      benefits: string[];
      drawbacks: string[];
    };
    comparison: { dimension: string; snowball: string; avalanche: string }[];
  };
  debt_vs_investing: {
    focus_debt: { headline: string; condition: string; reasoning: string };
    mixed: { headline: string; condition: string; reasoning: string };
    consider_investing: { headline: string; condition: string; reasoning: string };
  };
  assessment: { wins: Record<string, string>; watch: Record<string, string> };
  direct_answers: Record<string, string>;
  messages: Record<string, string>;
};

export type SectionId = CarSpec["id"] | MortgageSpec["id"] | InvestmentSpec["id"];

export type CostlyMistakeQuestionOption = { id: string; label: string };

export type CostlyMistakeQuestion = {
  id: string;
  prompt: string;
  type: "yesno" | "choice";
  options?: CostlyMistakeQuestionOption[];
};

export type CostlyMistakeTopic = {
  id: string;
  name: string;
  emoji: string;
  category: string;
  status: "available" | "future";
  tagline: string;
  what_is_it: string;
  why_people_buy: string[];
  costs: string[];
  who_benefits: string[];
  alternatives: string[];
  questions_to_ask: string[];
  questions: CostlyMistakeQuestion[];
};

export type CostlyMistakesSpec = {
  id: "costly-mistakes";
  meta: { label: string; blurb: string; hub_intro: string };
  intro: string;
  principle: string;
  disclaimer: string;
  ai: {
    should: string[];
    should_not: string[];
    tone: string[];
    example_style: { avoid: string; use: string };
  };
  topics: CostlyMistakeTopic[];
};

export type FinancialLiteracyQuiz = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type FinancialLiteracyVisualScenario = {
  label: string;
  years: number;
  monthly: number;
  ratePct: number;
};

export type FinancialLiteracyTopic = {
  id: string;
  emoji: string;
  title: string;
  tagline: string;
  concept: string;
  explanation: string;
  example: string;
  takeaway: string;
  quiz?: FinancialLiteracyQuiz;
  visual?: { scenarios: FinancialLiteracyVisualScenario[] };
};

export type FinancialLiteracySpec = {
  id: "financial-literacy";
  meta: { label: string; blurb: string; hub_intro: string };
  disclaimer: string;
  topics: FinancialLiteracyTopic[];
};

export type BigPurchaseType = {
  id: string;
  label: string;
};

export type BigPurchaseSpec = {
  id: "big-purchase";
  meta: { label: string; blurb: string; hub_intro: string };
  purchase_types: BigPurchaseType[];
  constants: { starter_emergency_fund_target: number };
  rules: {
    comfortable_max_payment_pct: number;
    stretch_max_payment_pct: number;
    risky_payment_pct: number;
    comfortable_max_dti_pct: number;
    stretch_max_dti_pct: number;
    risky_dti_pct: number;
    min_ef_months_comfortable: number;
    min_ef_months_stretch: number;
    min_ef_months_risky: number;
    min_down_payment_pct_comfortable: number;
    min_down_payment_pct_stretch: number;
    max_financing_ratio_comfortable: number;
    max_financing_ratio_stretch: number;
    max_financing_ratio_risky: number;
    category_comfortable_max_score: number;
    category_stretch_max_score: number;
  };
  categories: {
    comfortable: { label: string; headline: string; description: string };
    stretch: { label: string; headline: string; description: string };
    risky: { label: string; headline: string; description: string };
  };
  assessment: {
    wins: Record<string, string>;
    watch: Record<string, string>;
    next_steps: Record<string, string>;
  };
  reflection_questions: string[];
  opportunity_cost: Record<string, string>;
  direct_answers: Record<string, string>;
  messages: Record<string, string>;
};

export type PlatformSpec = {
  conversation: {
    principles: string[];
    tone: string[];
    when_confused: string[];
  };
};

export type AiBehaviorSpec = {
  core_principle: string;
  role: { should: string[]; should_not: string[] };
  tone: { qualities: string[]; avoid: string[] };
  philosophy: string[];
  output_style: string[];
  assessment_explanation: { focus_on: string[]; approach: string[] };
  follow_up: { use_guided_prompts: boolean; examples: string[]; behavior: string[] };
  off_topic: { behavior: string[]; redirect_template: string };
  investment: { note: string; philosophy: string[] };
  car_loan: { philosophy: string[] };
  mortgage: { philosophy: string[] };
  can_i_buy_this: { status: string; philosophy: string[] };
  restrictions: { never: string[] };
  disclaimer: string;
  product_goal: string;
};
