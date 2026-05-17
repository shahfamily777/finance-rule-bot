/**
 * Fixed mortgage rules for this app (source of truth).
 * Used by mortgage-flow and section Q&A — keep in sync.
 */
export const MORTGAGE_RULES = {
  /** Minimum down payment as % of purchase price */
  MIN_DOWN_PAYMENT_PCT: 20,
  /** Only these amortization terms */
  PREFERRED_LOAN_TERMS_YEARS: [15, 30] as const,
  /** Refinance when new rate is at least this many points lower */
  REFINANCE_RATE_DROP_MIN_PCT: 1,
  /** Encourage extra principal payoff above this APR */
  HIGH_RATE_EXTRA_PAYOFF_PCT: 5,
  /** Max housing cost (PITI + hidden) as % of gross monthly income */
  MAX_HOUSING_PCT_OF_GROSS_INCOME: 35,
  /** Hidden costs (HOA, repairs, etc.) as % of PITI — use midpoint if user skips */
  HIDDEN_COST_PCT_LOW: 5,
  HIDDEN_COST_PCT_HIGH: 10,
  HIDDEN_COST_PCT_DEFAULT: 7.5,
  /** Rough closing costs if user does not provide ( % of purchase price ) */
  ESTIMATED_CLOSING_COST_PCT: 3,
} as const;

export const MORTGAGE_RULES_SUMMARY = `Mortgage rules in this app:
• 15- or 30-year loan only
• Refinance when rate drops ≥1%
• Before buying: 20% down + closing costs + emergency fund in cash (else keep renting)
• Extra payoff encouraged when rate >5%
• Total housing payment (mortgage + tax + insurance + ~5–10% for HOA/repairs) must be ≤35% of gross monthly income`;
