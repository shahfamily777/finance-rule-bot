import {
  formatAssessmentAnswer,
  type StructuredAssessment,
} from "@/lib/assessment-types";
import { monthlyPrincipalAndInterest } from "@/lib/loan-math";
import type { MortgageConversationState } from "@/lib/mortgage-flow";
import { MORTGAGE_RULES as R } from "@/lib/mortgage-rules";

function estimateClosingCosts(homePrice: number): number {
  return Math.round(homePrice * 0.03);
}

function downPaymentPct(d: MortgageConversationState["data"]): number | null {
  if (d.homePrice === null || d.downPayment === null || d.homePrice <= 0) return null;
  return (d.downPayment / d.homePrice) * 100;
}

function monthlyHoaAmount(d: MortgageConversationState["data"]): number {
  return d.monthlyHoaMaintenance ?? 0;
}

function resolveTaxAndInsurance(d: MortgageConversationState["data"]): {
  tax: number | null;
  ins: number | null;
} {
  return {
    tax: d.monthlyPropertyTax,
    ins: d.monthlyInsurance,
  };
}

function totalHousingAtPrice(
  price: number,
  d: MortgageConversationState["data"],
  tax: number,
  ins: number
): number | null {
  if (
    d.downPayment === null ||
    d.interestRatePct === null ||
    d.loanTermYears === null ||
    d.homePrice === null ||
    d.homePrice <= 0
  ) {
    return null;
  }
  const loan = Math.max(0, price - d.downPayment);
  const pi = monthlyPrincipalAndInterest(loan, d.interestRatePct, d.loanTermYears);
  const scale = price / d.homePrice;
  return pi + tax * scale + ins * scale + monthlyHoaAmount(d);
}

function maxAffordableHomePrice(
  d: MortgageConversationState["data"],
  tax: number,
  ins: number
): number | null {
  if (
    d.grossMonthlyIncome === null ||
    d.downPayment === null ||
    d.interestRatePct === null ||
    d.loanTermYears === null ||
    d.homePrice === null ||
    d.homePrice <= 0
  ) {
    return null;
  }
  const cap = d.grossMonthlyIncome * (R.MAX_HOUSING_PCT_OF_GROSS_INCOME / 100);
  const minPrice = d.downPayment;
  const fits = (price: number) => {
    const total = totalHousingAtPrice(price, d, tax, ins);
    return total !== null && total <= cap;
  };
  if (!fits(minPrice)) return null;

  let lo = minPrice;
  let hi = Math.max(d.homePrice, minPrice + 500_000);
  let best = minPrice;
  for (let i = 0; i < 40 && lo <= hi; i++) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

export function buildMortgageStructuredAssessment(
  state: MortgageConversationState
): StructuredAssessment {
  if (state.data.isRefinance) return buildRefiStructured(state);
  return buildPurchaseStructured(state);
}

function buildRefiStructured(state: MortgageConversationState): StructuredAssessment {
  const d = state.data;
  const cur = d.currentRatePct;
  const neu = d.newRatePct;
  const gap = cur !== null && neu !== null ? cur - neu : null;
  const refiOk = gap !== null && gap >= R.REFINANCE_RATE_DROP_MIN_PCT;
  const termOk =
    d.loanTermYears !== null &&
    (R.PREFERRED_LOAN_TERMS_YEARS as readonly number[]).includes(d.loanTermYears);
  const ready = Boolean(refiOk && termOk);

  const wins: StructuredAssessment["wins"] = [];
  const watchAreas: StructuredAssessment["watchAreas"] = [];
  const context: StructuredAssessment["context"] = [];

  if (cur !== null) context.push({ label: "Current rate", detail: `${cur}%` });
  if (neu !== null) context.push({ label: "New rate", detail: `${neu}%` });

  if (gap !== null) {
    if (refiOk) {
      wins.push({
        label: "Meaningful rate improvement",
        detail: `Dropping ${gap.toFixed(2)} points (need ≥${R.REFINANCE_RATE_DROP_MIN_PCT}) is a large enough improvement to be worth comparing against closing costs.`,
      });
    } else {
      watchAreas.push({
        label: "Rate drop is small",
        detail: `${gap.toFixed(2)} points of improvement — the rule looks for at least ${R.REFINANCE_RATE_DROP_MIN_PCT}. A smaller drop often doesn't cover closing costs.`,
        pass: false,
      });
    }
  }
  if (d.loanTermYears !== null) {
    if (termOk) {
      wins.push({
        label: "Standard loan term",
        detail: `A ${d.loanTermYears}-year term keeps the loan on a predictable, well-understood schedule.`,
      });
    } else {
      watchAreas.push({
        label: "Non-standard term",
        detail: `${d.loanTermYears} years — this app works with 15- or 30-year terms.`,
        pass: false,
      });
    }
  }

  const recommendedNextStep = !refiOk
    ? "Wait until the new rate is at least one full point below your current rate, then compare closing costs and break-even time."
    : !termOk
      ? "Use a 15- or 30-year term, then compare closing costs before applying."
      : "Compare closing costs and break-even time before you apply.";

  return {
    title: "Refinance assessment",
    status: ready ? "on_track" : "not_ready",
    statusHeadline: ready
      ? "Refinancing may fit the rate-drop rule"
      : "Not the right time to refinance under these rules",
    summary: ready
      ? "Your new rate is meaningfully lower than your current rate, and the term fits our guidelines. Closing costs still matter — this checklist is about the rate rule, not a full break-even analysis."
      : "Under these rules, refinancing usually waits for a clearer rate improvement or a valid 15/30-year term. That’s a patience play, not a failure.",
    wins,
    watchAreas,
    context,
    recommendedNextStep,
  };
}

function buildPurchaseStructured(state: MortgageConversationState): StructuredAssessment {
  const d = state.data;
  const downPct = downPaymentPct(d);
  const downOk = downPct !== null && downPct >= R.MIN_DOWN_PAYMENT_PCT;

  const closing =
    d.closingCosts ?? (d.homePrice !== null ? estimateClosingCosts(d.homePrice) : null);
  const requiredCash =
    d.downPayment !== null && closing !== null && d.emergencyFund !== null
      ? d.downPayment + closing + d.emergencyFund
      : null;
  const cashOk =
    requiredCash !== null && d.cashAvailable !== null && d.cashAvailable >= requiredCash;

  const termOk =
    d.loanTermYears !== null &&
    (R.PREFERRED_LOAN_TERMS_YEARS as readonly number[]).includes(d.loanTermYears);

  const loanAmount =
    d.homePrice !== null && d.downPayment !== null
      ? Math.max(0, d.homePrice - d.downPayment)
      : null;

  const pi =
    loanAmount !== null &&
    d.interestRatePct !== null &&
    d.loanTermYears !== null
      ? monthlyPrincipalAndInterest(loanAmount, d.interestRatePct, d.loanTermYears)
      : null;

  const { tax, ins } = resolveTaxAndInsurance(d);
  const hoa = monthlyHoaAmount(d);
  const totalHousing =
    pi !== null && tax !== null && ins !== null ? pi + tax + ins + hoa : null;
  const housingCap =
    d.grossMonthlyIncome !== null
      ? d.grossMonthlyIncome * (R.MAX_HOUSING_PCT_OF_GROSS_INCOME / 100)
      : null;
  const housingPct =
    totalHousing !== null && d.grossMonthlyIncome !== null && d.grossMonthlyIncome > 0
      ? (totalHousing / d.grossMonthlyIncome) * 100
      : null;
  const housingOk =
    housingPct !== null && housingPct <= R.MAX_HOUSING_PCT_OF_GROSS_INCOME;
  const maxPrice =
    tax !== null && ins !== null && d.homePrice !== null
      ? maxAffordableHomePrice(d, tax, ins)
      : null;

  const ready = Boolean(downOk && cashOk && termOk && housingOk);

  const wins: StructuredAssessment["wins"] = [];
  const watchAreas: StructuredAssessment["watchAreas"] = [];
  const context: StructuredAssessment["context"] = [];

  if (d.homePrice !== null) {
    context.push({
      label: "Purchase price",
      detail: `$${d.homePrice.toLocaleString()}`,
    });
  }

  if (d.downPayment !== null && downPct !== null) {
    if (downOk) {
      wins.push({
        label: "Solid down payment",
        detail: `Putting ${downPct.toFixed(1)}% down (target ≥${R.MIN_DOWN_PAYMENT_PCT}%) lowers your loan, monthly payment, and long-term interest.`,
      });
    } else {
      watchAreas.push({
        label: "Down payment below target",
        detail: `$${d.downPayment.toLocaleString()} is ${downPct.toFixed(1)}% — target is ≥${R.MIN_DOWN_PAYMENT_PCT}%. Less down means a larger loan and higher monthly cost.`,
        pass: false,
      });
    }
  }

  if (requiredCash !== null && d.cashAvailable !== null) {
    if (cashOk) {
      wins.push({
        label: "Cash-ready to buy",
        detail: `You have the cash for down payment, closing, and emergency fund ($${requiredCash.toLocaleString()} needed). Keeping reserves means a surprise cost won't become debt.`,
      });
    } else {
      watchAreas.push({
        label: "Cash reserves are short",
        detail: `Need about $${requiredCash.toLocaleString()} for down payment, closing, and emergency fund — you have $${d.cashAvailable.toLocaleString()}.`,
        pass: false,
      });
    }
  }

  if (totalHousing !== null && housingPct !== null) {
    if (housingOk) {
      wins.push({
        label: "Housing cost fits your income",
        detail: `At ${housingPct.toFixed(1)}% of gross income (max ${R.MAX_HOUSING_PCT_OF_GROSS_INCOME}%), your monthly housing leaves room to save, invest, and absorb surprises.`,
      });
    } else {
      watchAreas.push({
        label: "Housing payment may be too high",
        detail: `$${Math.round(totalHousing).toLocaleString()}/mo is ${housingPct.toFixed(1)}% of gross income — above the ${R.MAX_HOUSING_PCT_OF_GROSS_INCOME}% cap. This reduces monthly flexibility.`,
        pass: false,
      });
    }
  }

  if (d.loanTermYears !== null) {
    if (termOk) {
      wins.push({
        label: "Standard loan term",
        detail: `A ${d.loanTermYears}-year mortgage keeps the loan on a predictable, well-understood schedule.`,
      });
    } else {
      watchAreas.push({
        label: "Non-standard term",
        detail: `${d.loanTermYears} years — this app works with 15- or 30-year terms.`,
        pass: false,
      });
    }
  }

  if (maxPrice !== null) {
    const over =
      d.homePrice !== null && d.homePrice > maxPrice
        ? ` — about $${(d.homePrice - maxPrice).toLocaleString()} above estimated max`
        : d.homePrice !== null && d.homePrice <= maxPrice
          ? " — within estimated max at your inputs"
          : "";
    context.push({
      label: "Estimated max home price",
      detail: `$${maxPrice.toLocaleString()} at ≤${R.MAX_HOUSING_PCT_OF_GROSS_INCOME}% housing${over}`,
    });
  }

  let recommendedNextStep: string | null = null;
  if (!housingOk && housingCap !== null && totalHousing !== null) {
    recommendedNextStep = `Bring housing under the ${R.MAX_HOUSING_PCT_OF_GROSS_INCOME}% cap (about $${Math.round(totalHousing - housingCap).toLocaleString()}/mo over) with a lower price or more down — or keep renting for now.`;
  } else if (!cashOk) {
    recommendedNextStep =
      "Build cash for the down payment, closing costs, and emergency fund together before buying — not borrowed for the down payment.";
  } else if (!downOk) {
    recommendedNextStep = `Work toward at least ${R.MIN_DOWN_PAYMENT_PCT}% down before buying.`;
  } else if (!termOk) {
    recommendedNextStep = "Use a 15- or 30-year mortgage term.";
  } else if (ready) {
    recommendedNextStep =
      "Under these rules, buying may be reasonable. Revisit tax, insurance, and HOA quotes before you close.";
  }

  return {
    title: "Home purchase assessment",
    status: ready ? "on_track" : housingOk === false ? "not_ready" : "needs_attention",
    statusHeadline: ready
      ? "Your numbers fit the mortgage guidelines"
      : !housingOk
        ? "Housing cost is above the income cap"
        : "A few items still need attention before buying",
    summary: ready
      ? "Cash readiness, loan term, down payment, and monthly housing at your stated tax and insurance fit this app’s buying rules. Use this as a structured checklist — not a substitute for quotes from lenders and insurers."
      : "You've already got some foundations in place. The watch areas below usually point to cash, price, or monthly housing cost — concrete things to adjust, not a vague “maybe someday.”",
    wins,
    watchAreas,
    context,
    recommendedNextStep,
  };
}

export function mortgageAssessmentAnswer(state: MortgageConversationState): string {
  return formatAssessmentAnswer(buildMortgageStructuredAssessment(state));
}
