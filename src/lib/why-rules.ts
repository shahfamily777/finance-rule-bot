/**
 * "Why These Rules?" — transparent explanations for every fixed rule in the app.
 * Each entry states the rule, why it exists, where it comes from, the assumptions
 * baked in, and honest alternative viewpoints. Values are sourced from the
 * compiled specs so this page never drifts from the rule engine.
 */
import { carSpec, investmentSpec, mortgageSpec } from "@/lib/specs";

export type RuleExplanation = {
  id: string;
  rule: string;
  why: string;
  source: string;
  assumptions: string;
  alternativeViewpoints: string;
};

export type RuleGroup = {
  id: string;
  title: string;
  emoji: string;
  intro: string;
  rules: RuleExplanation[];
};

const car = carSpec.rules;
const mortgage = mortgageSpec.rules;

export const WHY_RULES: RuleGroup[] = [
  {
    id: "car-loan",
    title: "Car Loan",
    emoji: "🚗",
    intro:
      "Cars lose value quickly, so these rules are about not owing more than the car is worth and not letting transportation crowd out everything else.",
    rules: [
      {
        id: "car-down",
        rule: `Put at least ${car.min_down_payment_pct}% down.`,
        why: "A larger down payment shrinks the loan and keeps you from going 'upside down' — owing more than the car is worth while it depreciates fastest in the first years.",
        source:
          "A widely used consumer-finance guideline (often cited as '20% down' for cars), adapted as a fixed floor here.",
        assumptions:
          "Assumes a typical new/used car depreciation curve and that you're financing rather than paying cash.",
        alternativeViewpoints:
          "Some buyers with very strong cash flow or a 0% promotional rate intentionally put less down to keep cash liquid. This app prioritizes the lower-risk default over optimizing for cheap credit.",
      },
      {
        id: "car-term",
        rule: `Keep the loan term at ${car.max_loan_term_months} months (${car.max_loan_term_years} years) or less — no exceptions.`,
        why: "Long terms lower the monthly payment but stretch payments past the point where the car holds its value, increasing total interest and the time spent upside down.",
        source:
          "Derived from depreciation-vs-amortization reasoning; 48 months is set as the hard ceiling in this app.",
        assumptions:
          "Assumes the car should be a depreciating tool you can pay off well within its useful life, not a long-term financed asset.",
        alternativeViewpoints:
          "60–72 month loans are extremely common and let people buy more car now. We deliberately don't allow them — if the payment only works past 48 months, we treat the car as too expensive for the budget.",
      },
      {
        id: "car-transport",
        rule: `Keep total transportation (loan payment + insurance + fuel/charging) at or below ${car.max_transport_pct_of_gross}% of gross monthly income.`,
        why: "Capping transportation protects the rest of your budget — saving, investing, and emergencies — from being squeezed by a car.",
        source:
          "A conservative take on common 'transportation should be 10–15% of income' budgeting guidance.",
        assumptions:
          "Uses gross (pre-tax) income and excludes maintenance/repairs from the cap to keep inputs simple.",
        alternativeViewpoints:
          "Other budgets allow 15–20% for transportation, especially where a car is essential for work. We use the lower end to stay on the safe side.",
      },
    ],
  },
  {
    id: "mortgage",
    title: "Mortgage",
    emoji: "🏠",
    intro:
      "Housing is usually the largest monthly cost, so these rules focus on buying only when you're truly ready and keeping the payment from dominating your income.",
    rules: [
      {
        id: "mortgage-housing",
        rule: `Keep total housing (principal & interest + property tax + insurance + HOA/maintenance) at or below ${mortgage.max_housing_pct_of_gross}% of gross monthly income.`,
        why: "A capped housing payment leaves room to save, invest, and absorb surprises instead of being 'house poor.'",
        source:
          "A stricter cousin of the classic 28% front-end DTI guideline, expanded to include taxes, insurance, and upkeep.",
        assumptions:
          "Uses gross income and assumes tax/insurance/HOA are reasonably estimated up front.",
        alternativeViewpoints:
          "Lenders often approve front-end ratios closer to 28–31% (or higher). We use 35% of all-in housing — and don't recommend stretching to the lender's maximum.",
      },
      {
        id: "mortgage-readiness",
        rule: `Before buying, have ${mortgage.min_down_payment_pct}% down + closing costs + a funded emergency fund in cash — otherwise keep renting.`,
        why: "Buying without reserves turns a normal surprise (repair, job gap) into debt. Cash readiness is what makes ownership lower-stress.",
        source:
          "Combines the conventional 20%-down threshold (avoids PMI) with an emergency-fund-first principle.",
        assumptions:
          "Assumes the down payment and emergency fund are saved, not borrowed, and the emergency fund stays intact after closing.",
        alternativeViewpoints:
          "Low-down-payment loans (FHA, VA, 3–5% conventional) help people buy sooner. They're valid options; this app favors waiting until you can buy with a margin of safety.",
      },
      {
        id: "mortgage-term",
        rule: `Use a ${mortgage.preferred_loan_terms_years.join("- or ")}-year fixed term only.`,
        why: "15- and 30-year fixed loans are predictable and widely understood: 15 minimizes interest, 30 minimizes the monthly payment.",
        source: "Standard fixed-rate mortgage products.",
        assumptions:
          "Assumes a fixed-rate loan and that you'll choose based on cash flow vs total interest.",
        alternativeViewpoints:
          "ARMs and 40-year loans exist and can fit specific situations. We exclude them to keep the decision simple and the risk lower.",
      },
      {
        id: "mortgage-refi",
        rule: `Refinance when the new rate is at least ${mortgage.refinance_rate_drop_min_pct} percentage point lower; pay extra principal when your rate is above ${mortgage.high_rate_extra_payoff_pct}%.`,
        why: "A ~1-point drop is a rough threshold where savings tend to outweigh closing costs; above ~5%, extra principal is a strong guaranteed return.",
        source:
          "Common 'refinance at ~1% lower' rule of thumb plus a rate-based payoff heuristic.",
        assumptions:
          "Assumes typical closing costs and that you'll keep the loan long enough to break even.",
        alternativeViewpoints:
          "Break-even depends on your exact costs and how long you stay; sometimes a smaller drop is worth it, sometimes a bigger one isn't. Always check your own break-even point.",
      },
    ],
  },
  {
    id: "investment",
    title: "Money Priority Plan",
    emoji: "📈",
    intro:
      "Where your next dollar should go, in order. The sequence puts guaranteed wins and safety before long-term growth.",
    rules: investmentSpec.priority_order.map((step) => ({
      id: `invest-${step.step}`,
      rule: `Step ${step.step}: ${step.summary}`,
      why: stepWhy(step.key),
      source:
        "A consolidated version of the well-known personal-finance 'order of operations' (financial order of operations / flowchart) used by many educators.",
      assumptions:
        "Assumes you work the steps in order and only move on once earlier safety layers are in place.",
      alternativeViewpoints:
        "Exact ordering varies between educators (e.g. some pay all debt before any investing, some prioritize Roth differently). We use one consistent, conservative sequence.",
    })),
  },
];

function stepWhy(key: string): string {
  switch (key) {
    case "MATCH_401K":
      return "An employer match is an immediate, guaranteed return — no other step beats it, so it comes first.";
    case "STARTER_EMERGENCY":
      return "A small cushion stops a surprise cost from becoming high-interest debt while you tackle bigger goals.";
    case "DEBT_FIRST":
      return "High-interest debt is a guaranteed cost that usually outruns market returns, so clearing it is effectively risk-free growth.";
    case "FULL_EMERGENCY":
      return "Three to six months of expenses lets you invest steadily without being forced to sell during a rough patch.";
    case "HSA_PRIORITY":
      return "When eligible, an HSA offers a rare triple tax advantage for health and retirement costs.";
    case "ROTH_NEXT":
      return "Tax-advantaged growth compounds for decades; a Roth is valuable once the safety layers are covered.";
    case "MAX_RETIREMENT":
      return "After the basics, raising tax-advantaged contributions puts more money to work efficiently each year.";
    case "BROKERAGE_INVESTING":
      return "Remaining long-term money goes into diversified, low-cost index funds for flexible growth.";
    default:
      return "Each step builds on the safety of the ones before it.";
  }
}
