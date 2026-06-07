/**
 * Conversational sanity checks — respond like a person, not a form.
 * Run after parsing user input; ask clarifying questions when numbers don't fit together.
 */

import { computeMonthlyLoanPayment, monthlyPrincipalAndInterest } from "@/lib/loan-math";
import { looksLikeDataCorrection } from "@/lib/field-corrections";
import { parseYesNo } from "@/lib/intake-policy";
import type { CarLoanConversationState } from "@/lib/car-loan-flow";
import type { MortgageConversationState } from "@/lib/mortgage-flow";

export type FlowConcern = {
  id: string;
  message: string;
  /** Re-ask this stage after clarification */
  stage?: string;
};

export type ConversationalState = {
  addressedConcerns?: string[];
  /** Set when we asked a clarifying question; cleared after the user's next reply */
  lastConcernShown?: string;
};

function isAddressed(state: ConversationalState, id: string): boolean {
  return (state.addressedConcerns ?? []).includes(id);
}

function markAddressed(state: ConversationalState, id: string): ConversationalState {
  const set = new Set(state.addressedConcerns ?? []);
  set.add(id);
  return { addressedConcerns: [...set] };
}

/** User is correcting earlier numbers */
export function looksLikeCorrection(text: string): boolean {
  return looksLikeDataCorrection(text);
}

// --- Car loan ---

const CAR_MIN_DOWN_PCT = 20;
const CAR_MAX_TRANSPORT_PCT = 10;

export function getCarLoanConcerns(
  data: CarLoanConversationState["data"],
  addressed: string[]
): FlowConcern[] {
  const out: FlowConcern[] = [];
  const skip = new Set(addressed);

  const price = data.vehiclePrice;
  const down = data.downPayment;
  const income = data.grossMonthlyIncome;

  if (price !== null && down !== null && down > price) {
    if (!skip.has("down_gt_price")) {
      out.push({
        id: "down_gt_price",
        message:
          `You have **$${down.toLocaleString()}** down on a **$${price.toLocaleString()}** vehicle — down payment normally can't exceed the purchase price.\n\n` +
          "Did you mean a different **car price**, or is part of that a **trade-in**? Share the price and cash down separately.",
        stage: "down_payment",
      });
    }
  }

  if (price !== null && down !== null && price > 0) {
    const pct = (down / price) * 100;
    if (pct < CAR_MIN_DOWN_PCT - 0.5 && !skip.has("down_below_min")) {
      out.push({
        id: "down_below_min",
        message:
          `That's about **${pct.toFixed(0)}%** down — our guideline is **at least ${CAR_MIN_DOWN_PCT}%** ($${Math.ceil(price * (CAR_MIN_DOWN_PCT / 100)).toLocaleString()} here).\n\n` +
          "Are you planning to add more down, or do you want to continue with these numbers so we can see the full picture?",
        stage: "down_payment",
      });
    }
    if (pct > 95 && down < price && !skip.has("down_almost_full")) {
      out.push({
        id: "down_almost_full",
        message:
          `You're putting **${pct.toFixed(0)}%** down — only **$${(price - down).toLocaleString()}** would be financed. Just confirming that's intentional (near cash purchase)?`,
        stage: "loan_term",
      });
    }
  }

  if (income !== null && income < 800 && !skip.has("income_very_low")) {
    out.push({
      id: "income_very_low",
      message:
        `**$${income.toLocaleString()}/mo** gross income is quite low for a traditional auto loan checklist. Is that **monthly gross**, or did you mean **annual** (e.g. $${(income * 12).toLocaleString()}/year)?`,
      stage: "gross_income",
    });
  }

  if (
    income !== null &&
    price !== null &&
    data.loanTermMonths !== null &&
    data.annualInterestRatePct !== null &&
    down !== null
  ) {
    const principal = Math.max(0, price - down);
    const payment = computeMonthlyLoanPayment(
      principal,
      data.annualInterestRatePct,
      data.loanTermMonths
    );
    const payPct = (payment / income) * 100;
    if (payPct > CAR_MAX_TRANSPORT_PCT + 5 && !skip.has("payment_vs_income")) {
      out.push({
        id: "payment_vs_income",
        message:
          `Quick sanity check: the **loan payment alone** (~$${payment.toLocaleString()}/mo) is about **${payPct.toFixed(0)}%** of your **$${income.toLocaleString()}** gross income — and we still need insurance + gas (cap **${CAR_MAX_TRANSPORT_PCT}%** total).\n\n` +
          "Does that income number look right, or is this a second car / shared household income we should factor in?",
        stage: "gross_income",
      });
    }
  }

  if (income !== null && price !== null && price / income > 40 && !skip.has("price_vs_income")) {
    out.push({
      id: "price_vs_income",
      message:
        `A **$${price.toLocaleString()}** car on **$${income.toLocaleString()}/mo** income is a big ratio (~${(price / income).toFixed(0)}× monthly gross) before payment and insurance.\n\n` +
        "Just checking — is that income **yours only**, and is the **$" +
        price.toLocaleString() +
        "** price the out-the-door amount you're considering?",
      stage: "gross_income",
    });
  }

  return out;
}

export function pickCarLoanConcern(
  state: CarLoanConversationState & ConversationalState,
  lastUserText: string
): { concern: FlowConcern; state: CarLoanConversationState } | null {
  if (looksLikeCorrection(lastUserText)) {
    return null;
  }
  if (parseYesNo(lastUserText) !== null && lastUserText.trim().length < 12) {
    return null;
  }

  const concerns = getCarLoanConcerns(state.data, state.addressedConcerns ?? []);
  const first = concerns[0];
  if (!first) return null;

  return {
    concern: first,
    state: {
      ...state,
      lastConcernShown: first.id,
      stage: (first.stage ?? state.stage) as CarLoanConversationState["stage"],
    },
  };
}

export function acknowledgeLastConcern<T extends ConversationalState>(
  state: T,
  lastUserText: string
): T {
  if (!state.lastConcernShown || !lastUserText.trim()) return state;
  return {
    ...markAddressed(state, state.lastConcernShown),
    lastConcernShown: undefined,
  } as T;
}

export function autoResolveCarConcerns(
  state: CarLoanConversationState & ConversationalState
): CarLoanConversationState & ConversationalState {
  const d = state.data;
  let addressed = [...(state.addressedConcerns ?? [])];

  if (d.vehiclePrice !== null && d.downPayment !== null && d.downPayment <= d.vehiclePrice) {
    addressed.push("down_gt_price");
  }
  if (d.grossMonthlyIncome !== null && d.grossMonthlyIncome >= 800) {
    addressed.push("income_very_low");
  }
  if (d.vehiclePrice !== null && d.downPayment !== null && d.vehiclePrice > 0) {
    const pct = (d.downPayment / d.vehiclePrice) * 100;
    if (pct >= CAR_MIN_DOWN_PCT) addressed.push("down_below_min");
  }

  return { ...state, addressedConcerns: [...new Set(addressed)] };
}

// --- Mortgage ---

const MORTGAGE_MIN_DOWN_PCT = 20;
const MORTGAGE_MAX_HOUSING_PCT = 35;

function roughMortgagePiti(
  d: MortgageConversationState["data"],
  estimatePi: (loan: number, rate: number, years: number) => number,
  estimateTax: (price: number) => number,
  estimateIns: (price: number) => number,
  hiddenPct: number
): number | null {
  if (d.homePrice === null || d.downPayment === null) return null;
  const loan = Math.max(0, d.homePrice - d.downPayment);
  const rate = d.interestRatePct ?? 7;
  const years = d.loanTermYears ?? 30;
  const pi = estimatePi(loan, rate, years);
  const tax = d.monthlyPropertyTax ?? estimateTax(d.homePrice);
  const ins = d.monthlyInsurance ?? estimateIns(d.homePrice);
  const hidden =
    d.monthlyHoaMaintenance !== null && d.monthlyHoaMaintenance > 0
      ? d.monthlyHoaMaintenance
      : Math.round((pi + tax + ins) * (hiddenPct / 100));
  return pi + tax + ins + hidden;
}

export function getMortgageConcerns(
  data: MortgageConversationState["data"],
  addressed: string[],
  helpers: {
    estimatePi: (loan: number, rate: number, years: number) => number;
    estimateTax: (price: number) => number;
    estimateIns: (price: number) => number;
    hiddenPct: number;
    requiredCash: (d: MortgageConversationState["data"]) => number | null;
  }
): FlowConcern[] {
  const out: FlowConcern[] = [];
  const skip = new Set(addressed);

  const price = data.homePrice;
  const down = data.downPayment;
  const income = data.grossMonthlyIncome;

  if (price !== null && down !== null && down > price) {
    if (!skip.has("down_gt_price")) {
      out.push({
        id: "down_gt_price",
        message:
          `**$${down.toLocaleString()}** down on a **$${price.toLocaleString()}** home can't be right as stated.\n\n` +
          "Is the **purchase price** or **down payment** different? (Trade-in equity counts toward down, but price should still be the home value.)",
        stage: "down_payment",
      });
    }
  }

  if (price !== null && down !== null && price > 0) {
    const pct = (down / price) * 100;
    if (pct < MORTGAGE_MIN_DOWN_PCT - 0.5 && !skip.has("down_below_min")) {
      out.push({
        id: "down_below_min",
        message:
          `That's roughly **${pct.toFixed(0)}%** down — we use **${MORTGAGE_MIN_DOWN_PCT}%** minimum before recommending a purchase (otherwise **keep renting**).\n\n` +
          "Will you put more down, or are you exploring whether this price is realistic?",
        stage: "down_payment",
      });
    }
  }

  if (income !== null && income < 1500 && !skip.has("income_very_low")) {
    out.push({
      id: "income_very_low",
      message:
        `**$${income.toLocaleString()}/mo** gross seems low for a mortgage worksheet. Did you mean **annual** income, or is there another earner on the loan?`,
      stage: "gross_income",
    });
  }

  const piti = roughMortgagePiti(data, helpers.estimatePi, helpers.estimateTax, helpers.estimateIns, helpers.hiddenPct);
  if (piti !== null && income !== null && income > 0) {
    const pct = (piti / income) * 100;
    if (pct > MORTGAGE_MAX_HOUSING_PCT + 8 && !skip.has("housing_stretch")) {
      out.push({
        id: "housing_stretch",
        message:
          `Heads-up: with these numbers, total housing (payment + tax + insurance + allowance for HOA/repairs) lands around **$${Math.round(piti).toLocaleString()}/mo** — about **${pct.toFixed(0)}%** of **$${income.toLocaleString()}** gross. Our buy guideline is **≤${MORTGAGE_MAX_HOUSING_PCT}%**.\n\n` +
          "Is the income figure correct, or should we look at a lower price / larger down / different term?",
        stage: "gross_income",
      });
    }
  }

  const need = helpers.requiredCash(data);
  if (
    need !== null &&
    income !== null &&
    need > income * 18 &&
    data.cashAvailable === null &&
    !skip.has("cash_vs_income")
  ) {
    out.push({
      id: "cash_vs_income",
      message:
        `You'd need about **$${need.toLocaleString()}** cash (down + closing + emergency fund) — that's roughly **${(need / (income * 12)).toFixed(1)}×** your annual gross income.\n\n` +
        "Just so we're realistic: is that amount **saved and liquid** (not from selling assets later)?",
      stage: "cash_available",
    });
  }

  if (
    data.emergencyFund !== null &&
    income !== null &&
    data.emergencyFund > income * 12 &&
    !skip.has("ef_large")
  ) {
    out.push({
      id: "ef_large",
      message:
        `An **$${data.emergencyFund.toLocaleString()}** emergency fund after closing is strong (over a year of gross income on paper). That's fine if accurate — is that **separate** from the down payment and closing cash?`,
      stage: "emergency_fund",
    });
  }

  return out;
}

export function pickMortgageConcern(
  state: MortgageConversationState & ConversationalState,
  lastUserText: string,
  helpers: Parameters<typeof getMortgageConcerns>[2]
): { concern: FlowConcern; state: MortgageConversationState } | null {
  if (looksLikeCorrection(lastUserText)) return null;
  if (parseYesNo(lastUserText) !== null && lastUserText.trim().length < 12) return null;

  const concerns = getMortgageConcerns(state.data, state.addressedConcerns ?? [], helpers);
  const first = concerns[0];
  if (!first) return null;

  return {
    concern: first,
    state: {
      ...state,
      lastConcernShown: first.id,
      stage: (first.stage ?? state.stage) as MortgageConversationState["stage"],
    },
  };
}

export function autoResolveMortgageConcerns(
  state: MortgageConversationState & ConversationalState,
  helpers: { requiredCash: (d: MortgageConversationState["data"]) => number | null }
): MortgageConversationState & ConversationalState {
  const d = state.data;
  let addressed = [...(state.addressedConcerns ?? [])];

  if (d.homePrice !== null && d.downPayment !== null && d.downPayment <= d.homePrice) {
    addressed.push("down_gt_price");
  }
  if (d.grossMonthlyIncome !== null && d.grossMonthlyIncome >= 1500) {
    addressed.push("income_very_low");
  }

  return { ...state, addressedConcerns: [...new Set(addressed)] };
}
