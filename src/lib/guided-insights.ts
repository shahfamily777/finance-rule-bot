import type { SectionId } from "@/lib/section-theme";

export type GuidedInsight = { text: string };

const CAR: Record<string, GuidedInsight> = {
  vehicle_price: {
    text: "The purchase price sets everything else — payment, down payment target, and insurance context.",
  },
  down_payment: {
    text: "Higher down payments reduce long-term pressure and help you stay ahead of depreciation.",
  },
  loan_term: {
    text: "Longer loans reduce the monthly payment but increase total interest and risk.",
  },
  gross_income: {
    text: "We use gross monthly income (before taxes) for the transportation cap — be consistent with your pay stub.",
  },
  interest_rate: {
    text: "APR drives your monthly payment. Even a small rate change adds up over the full term.",
  },
  insurance: {
    text: "Insurance is part of your monthly transportation budget, not a separate “extra.”",
  },
  fuel: {
    text: "Gas or charging counts toward the same 10% transportation cap as the loan and insurance.",
  },
};

const MORTGAGE: Record<string, GuidedInsight> = {
  scenario: {
    text: "Buying and refinancing follow different checklists — we’ll only ask what applies to you.",
  },
  home_price: {
    text: "Price is the anchor. Affordability depends on income, down payment, and your real tax and insurance numbers.",
  },
  gross_income: {
    text: "Housing costs are compared to gross monthly income — the same basis lenders often use.",
  },
  down_payment: {
    text: "A larger down payment lowers the loan and monthly payment, and strengthens your cash position at closing.",
  },
  emergency_fund: {
    text: "Keeping an emergency fund separate from your down payment protects you after you move in.",
  },
  closing_costs: {
    text: "Closing costs are easy to underestimate — planning for them avoids last-minute stress.",
  },
  cash_ready: {
    text: "Cash should cover down payment, closing, and emergency savings — not be borrowed for the down payment.",
  },
  interest_rate: {
    text: "Rate and term together shape your monthly payment for years — small differences matter.",
  },
  loan_term: {
    text: "A 15-year loan costs more per month but far less interest over time than 30 years.",
  },
  property_tax: {
    text: "Use your actual tax quote or escrow estimate — we don’t guess this from home price alone.",
  },
  insurance: {
    text: "Homeowners insurance varies by property — enter what you were quoted, not a rule of thumb.",
  },
  hoa: {
    text: "HOA or maintenance is optional here. Leave blank if none — we won’t assume a hidden fee.",
  },
  current_rate: {
    text: "Refinancing usually makes sense when the new rate is meaningfully lower than what you pay now.",
  },
  new_rate: {
    text: "Compare the new rate to your current payment — savings should outweigh closing costs over time.",
  },
};

const INVESTMENT: Record<string, GuidedInsight> = {
  invest_amount: {
    text: "Optional — we can still build your priority order without a specific dollar amount.",
  },
  match: {
    text: "Employer match is often the highest-return “investment” available — if you have one, it’s usually first.",
  },
  starter_emergency: {
    text: "A small starter emergency fund keeps surprises from pushing you back into debt.",
  },
  high_interest_debt: {
    text: "High-interest debt often costs more than long-term market returns — paying it down can be a smart move first.",
  },
  full_emergency: {
    text: "A full emergency fund (3–6 months) gives you room to invest without panic-selling later.",
  },
  hsa: {
    text: "An HSA can be powerful if you’re eligible — but only when it fits your health plan.",
  },
  roth: {
    text: "Roth IRA space is limited each year — using it when you can is part of the priority order.",
  },
  max_401k: {
    text: "Maxing a 401(k) is a long-term goal — the order tells you when to prioritize it vs other buckets.",
  },
};

export function getGuidedInsight(
  section: SectionId,
  stepId: string
): GuidedInsight | null {
  const map =
    section === "car-loan" ? CAR : section === "mortgage" ? MORTGAGE : INVESTMENT;
  return map[stepId] ?? null;
}
