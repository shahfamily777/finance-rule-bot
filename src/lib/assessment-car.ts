import type { CarLoanConversationState } from "@/lib/car-loan-flow";
import {
  formatAssessmentAnswer,
  type StructuredAssessment,
} from "@/lib/assessment-types";

const MIN_DOWN_PCT = 20;
const MAX_TERM_MONTHS = 48;
const MAX_TRANSPORT_PCT = 10;

function downPaymentPct(d: CarLoanConversationState["data"]): number | null {
  if (d.vehiclePrice === null || d.downPayment === null || d.vehiclePrice <= 0) return null;
  return (d.downPayment / d.vehiclePrice) * 100;
}

function transportMonthly(d: CarLoanConversationState["data"]): number | null {
  if (d.monthlyTransportTotal !== null) return d.monthlyTransportTotal;
  const payment = d.monthlyCarPayment ?? 0;
  const ins = d.monthlyInsurance ?? 0;
  const fuel = d.monthlyFuel ?? 0;
  if (payment === 0 && ins === 0 && fuel === 0) return null;
  return payment + ins + fuel;
}

export function buildCarLoanStructuredAssessment(
  state: CarLoanConversationState
): StructuredAssessment {
  const d = state.data;
  const downPct = downPaymentPct(d);
  const transport = transportMonthly(d);
  const transportPct =
    transport !== null && d.grossMonthlyIncome !== null && d.grossMonthlyIncome > 0
      ? (transport / d.grossMonthlyIncome) * 100
      : null;

  const downOk = downPct !== null && downPct >= MIN_DOWN_PCT;
  const termOk = d.loanTermMonths !== null && d.loanTermMonths <= MAX_TERM_MONTHS;
  const transportOk =
    transportPct !== null && transportPct <= MAX_TRANSPORT_PCT;
  const allOk = Boolean(downOk && termOk && transportOk);

  const wins: StructuredAssessment["wins"] = [];
  const watchAreas: StructuredAssessment["watchAreas"] = [];
  const context: StructuredAssessment["context"] = [];

  if (d.downPayment !== null && downPct !== null) {
    if (downOk) {
      wins.push({
        label: "Strong down payment",
        detail: `Putting ${downPct.toFixed(1)}% down (target ≥${MIN_DOWN_PCT}%) reduces the loan size and protects you from going upside-down as the car depreciates.`,
      });
    } else {
      watchAreas.push({
        label: "Down payment below 20%",
        detail: `$${d.downPayment.toLocaleString()} is ${downPct.toFixed(1)}% — target is ≥${MIN_DOWN_PCT}%. A smaller down payment means more borrowed and higher depreciation risk.`,
        pass: false,
      });
    }
  }

  if (d.loanTermMonths !== null) {
    if (termOk) {
      wins.push({
        label: "Sensible loan term",
        detail: `A ${d.loanTermMonths}-month term (max ${MAX_TERM_MONTHS}) keeps total interest down and helps you stay ahead of the car's depreciation.`,
      });
    } else {
      watchAreas.push({
        label: "Loan term too long",
        detail: `${d.loanTermMonths} months is over the ${MAX_TERM_MONTHS}-month max. Longer loans lower the monthly payment but increase total cost and upside-down risk.`,
        pass: false,
      });
    }
  }

  if (transport !== null && transportPct !== null) {
    if (transportOk) {
      wins.push({
        label: "Transportation cost is manageable",
        detail: `At ${transportPct.toFixed(1)}% of gross income (cap ${MAX_TRANSPORT_PCT}%), your payment, insurance, and fuel leave room for saving and unexpected costs.`,
      });
    } else {
      watchAreas.push({
        label: "Transportation share is high",
        detail: `$${transport.toLocaleString()}/mo is ${transportPct.toFixed(1)}% of gross income — the cap is ${MAX_TRANSPORT_PCT}%. This reduces monthly flexibility.`,
        pass: false,
      });
    }
  }

  if (d.monthlyCarPayment !== null && d.annualInterestRatePct !== null) {
    context.push({
      label: "Estimated loan payment",
      detail: `$${d.monthlyCarPayment.toLocaleString()}/mo at ${d.annualInterestRatePct}% APR`,
    });
  }

  let recommendedNextStep: string | null = null;
  if (!transportOk && transport !== null) {
    recommendedNextStep = `Bring total transportation (payment + insurance + fuel/charging) to ≤${MAX_TRANSPORT_PCT}% of gross income — a lower price, more down, or a better rate are the levers, not a longer loan.`;
  } else if (!downOk) {
    const need =
      d.vehiclePrice !== null
        ? Math.ceil(d.vehiclePrice * (MIN_DOWN_PCT / 100))
        : null;
    recommendedNextStep =
      need !== null
        ? `Build toward at least $${need.toLocaleString()} down (20%) before financing to reduce depreciation risk.`
        : `Aim for at least ${MIN_DOWN_PCT}% down on the purchase price.`;
  } else if (!termOk) {
    recommendedNextStep = `Keep the loan at ${MAX_TERM_MONTHS} months or less — choose a shorter term, a cheaper car, or more down rather than a longer loan.`;
  } else if (allOk) {
    recommendedNextStep =
      "You meet all three rules. Keep the term at or below 48 months and recheck insurance and fuel if anything changes.";
  }

  return {
    title: "Car loan assessment",
    status: allOk ? "on_track" : "needs_attention",
    statusHeadline: allOk
      ? "Your numbers fit the car loan guidelines"
      : "One or more rules need adjustment before financing",
    summary: allOk
      ? "Based on what you entered, your down payment, loan term, and transportation share of income align with this app’s fixed car loan rules. These limits are intentional — they keep monthly pressure manageable."
      : "Based on what you entered, you've already got some pieces in place. The watch areas below point to concrete changes — down payment, term, or total transportation — rather than a vague “maybe later.”",
    wins,
    watchAreas,
    context,
    recommendedNextStep,
  };
}

export function carLoanAssessmentAnswer(state: CarLoanConversationState): string {
  return formatAssessmentAnswer(buildCarLoanStructuredAssessment(state));
}
