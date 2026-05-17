/** Replace `{key}` placeholders in spec templates (from YAML). */
export function formatSpecTemplate(
  template: string,
  vars: Record<string, string | number | boolean | undefined>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? `{${key}}` : String(v);
  });
}

/** Build vars object for car-loan templates from spec rules + runtime numbers. */
export function carTemplateVars(
  rules: {
    min_down_payment_pct: number;
    max_loan_term_months: number;
    max_loan_term_years: number;
    max_transport_pct_of_gross: number;
  },
  extra?: Record<string, string | number>
): Record<string, string | number> {
  return {
    min_down_payment_pct: rules.min_down_payment_pct,
    max_loan_term_months: rules.max_loan_term_months,
    max_loan_term_years: rules.max_loan_term_years,
    max_transport_pct_of_gross: rules.max_transport_pct_of_gross,
    ...extra,
  };
}

export function mortgageTemplateVars(
  rules: {
    min_down_payment_pct: number;
    refinance_rate_drop_min_pct: number;
    high_rate_extra_payoff_pct: number;
    max_housing_pct_of_gross: number;
    hidden_cost_pct_low: number;
    hidden_cost_pct_high: number;
    hidden_cost_pct_default: number;
    estimated_closing_cost_pct: number;
    preferred_loan_terms_years: number[];
  },
  extra?: Record<string, string | number>
): Record<string, string | number> {
  const terms = rules.preferred_loan_terms_years.join("- or ");
  return {
    min_down_payment_pct: rules.min_down_payment_pct,
    refinance_rate_drop_min_pct: rules.refinance_rate_drop_min_pct,
    high_rate_extra_payoff_pct: rules.high_rate_extra_payoff_pct,
    max_housing_pct_of_gross: rules.max_housing_pct_of_gross,
    hidden_cost_pct_low: rules.hidden_cost_pct_low,
    hidden_cost_pct_high: rules.hidden_cost_pct_high,
    hidden_cost_pct_default: rules.hidden_cost_pct_default,
    estimated_closing_cost_pct: rules.estimated_closing_cost_pct,
    loan_terms_label: `${terms}-year`,
    ...extra,
  };
}
