import {
  formatAssessmentAnswer,
  type StructuredAssessment,
} from "@/lib/assessment-types";
import { debtSpec } from "@/lib/specs/bundle";

export type DebtItem = {
  balance: number;
  interestRatePct: number;
};

export type DebtAssessmentInput = {
  creditCard: DebtItem;
  personalLoan: DebtItem;
  autoLoan: DebtItem;
  studentLoan: DebtItem;
  mortgage: DebtItem;
  emergencyFund: number;
  monthlySurplus: number;
};

const HIGH_INTEREST = debtSpec.rules.high_interest_debt_pct;
const STARTER_EF = debtSpec.constants.starter_emergency_fund_target;

function hasBalance(item: DebtItem): boolean {
  return item.balance > 0;
}

function isHighInterest(rate: number): boolean {
  return rate >= HIGH_INTEREST;
}

function totalDebt(input: DebtAssessmentInput): number {
  return (
    input.creditCard.balance +
    input.personalLoan.balance +
    input.autoLoan.balance +
    input.studentLoan.balance +
    input.mortgage.balance
  );
}

function highInterestDebts(input: DebtAssessmentInput): { label: string; balance: number; rate: number }[] {
  const items: { label: string; balance: number; rate: number }[] = [];
  if (hasBalance(input.creditCard) && isHighInterest(input.creditCard.interestRatePct)) {
    items.push({
      label: "Credit card",
      balance: input.creditCard.balance,
      rate: input.creditCard.interestRatePct,
    });
  }
  if (hasBalance(input.personalLoan) && isHighInterest(input.personalLoan.interestRatePct)) {
    items.push({
      label: "Personal loan",
      balance: input.personalLoan.balance,
      rate: input.personalLoan.interestRatePct,
    });
  }
  if (hasBalance(input.autoLoan) && isHighInterest(input.autoLoan.interestRatePct)) {
    items.push({
      label: "Auto loan",
      balance: input.autoLoan.balance,
      rate: input.autoLoan.interestRatePct,
    });
  }
  if (hasBalance(input.studentLoan) && isHighInterest(input.studentLoan.interestRatePct)) {
    items.push({
      label: "Student loan",
      balance: input.studentLoan.balance,
      rate: input.studentLoan.interestRatePct,
    });
  }
  return items;
}

function allDebtsLowInterest(input: DebtAssessmentInput): boolean {
  const debts = [
    input.creditCard,
    input.personalLoan,
    input.autoLoan,
    input.studentLoan,
    input.mortgage,
  ].filter((d) => hasBalance(d));
  if (debts.length === 0) return false;
  return debts.every((d) => !isHighInterest(d.interestRatePct));
}

export function buildDebtStructuredAssessment(
  input: DebtAssessmentInput
): StructuredAssessment {
  const wins: StructuredAssessment["wins"] = [];
  const watchAreas: StructuredAssessment["watchAreas"] = [];

  const total = totalDebt(input);
  const highInterest = highInterestDebts(input);
  const hasCcDebt = hasBalance(input.creditCard);
  const positiveCashFlow = input.monthlySurplus > 0;
  const hasEmergencyFund = input.emergencyFund >= STARTER_EF;
  const noDebt = total === 0;

  if (!hasCcDebt) {
    wins.push({
      label: debtSpec.assessment.wins.no_credit_card,
      detail:
        "No revolving credit card balance means you are not paying double-digit interest on everyday spending.",
    });
  }

  if (positiveCashFlow) {
    wins.push({
      label: debtSpec.assessment.wins.positive_cash_flow,
      detail:
        `You have about $${input.monthlySurplus.toLocaleString()} left each month after expenses — that surplus can accelerate debt payoff or build savings.`,
    });
  }

  if (hasEmergencyFund) {
    wins.push({
      label: debtSpec.assessment.wins.emergency_fund,
      detail:
        `Your emergency fund of $${input.emergencyFund.toLocaleString()} meets the starter target (~$${STARTER_EF.toLocaleString()}), which helps avoid new debt when surprises happen.`,
    });
  }

  if (allDebtsLowInterest(input) && total > 0) {
    wins.push({
      label: debtSpec.assessment.wins.low_interest_only,
      detail:
        "All your outstanding balances carry rates below the high-interest threshold — less pressure to rush payoff at the expense of other goals.",
    });
  }

  if (total > 0 && positiveCashFlow) {
    wins.push({
      label: debtSpec.assessment.wins.consistent_payments,
      detail:
        "Positive cash flow with existing debt payments suggests you can stay current — and potentially pay extra toward the highest-priority balance.",
    });
  }

  if (hasCcDebt && isHighInterest(input.creditCard.interestRatePct)) {
    watchAreas.push({
      label: debtSpec.assessment.watch.high_interest_cc,
      detail:
        `Credit card balance of $${input.creditCard.balance.toLocaleString()} at ${input.creditCard.interestRatePct}% APR compounds quickly — this is usually the highest-priority payoff target.`,
    });
  }

  if (!hasEmergencyFund && total > 0) {
    watchAreas.push({
      label: debtSpec.assessment.watch.emergency_fund_low,
      detail:
        `Emergency fund of $${input.emergencyFund.toLocaleString()} is below the ~$${STARTER_EF.toLocaleString()} starter target. A small cushion reduces the chance of adding new debt.`,
    });
  }

  if (highInterest.length >= 2) {
    watchAreas.push({
      label: debtSpec.assessment.watch.multiple_high_interest,
      detail:
        `${highInterest.length} balances are at ${HIGH_INTEREST}% or above. Pick one payoff method (snowball or avalanche) and focus extra payments on a single target at a time.`,
    });
  }

  if (!positiveCashFlow) {
    watchAreas.push({
      label: debtSpec.assessment.watch.negative_cash_flow,
      detail:
        "Monthly expenses meet or exceed income — extra debt payments are difficult until cash flow improves. Review spending or income before aggressive payoff.",
    });
  }

  let recommendedNextStep: string | null = null;

  if (noDebt) {
    recommendedNextStep =
      "You have no reported debt balances. Consider directing surplus cash toward investing or building a larger emergency fund.";
  } else if (hasCcDebt && isHighInterest(input.creditCard.interestRatePct)) {
    recommendedNextStep =
      "Pay off high-interest credit card debt first — put any extra monthly cash toward the card balance while making minimums on other debts.";
  } else if (!hasEmergencyFund) {
    recommendedNextStep =
      `Build a starter emergency fund of about $${STARTER_EF.toLocaleString()} before aggressive extra debt payments, while still making all minimum payments on time.`;
  } else if (!positiveCashFlow) {
    recommendedNextStep =
      "Increase monthly cash flow — trim discretionary spending or explore income options — so you have room for extra debt payments.";
  } else if (highInterest.length > 0) {
    const top = highInterest.sort((a, b) => b.rate - a.rate)[0];
    recommendedNextStep =
      `Increase monthly payments on your ${top.label.toLowerCase()} (${top.rate}% APR) — the highest-rate balance is usually the best target for extra cash.`;
  } else {
    recommendedNextStep =
      "Continue consistent payments on all debts. With low rates, you may balance payoff with investing — see Debt vs Investing for guidance.";
  }

  let status: StructuredAssessment["status"] = "on_track";
  let statusHeadline = "Solid foundation";

  if (noDebt) {
    status = "on_track";
    statusHeadline = "Debt-free";
  } else if (
    (hasCcDebt && isHighInterest(input.creditCard.interestRatePct)) ||
    !positiveCashFlow
  ) {
    status = "needs_attention";
    statusHeadline = "High-priority items to address";
  } else if (!hasEmergencyFund || highInterest.length > 0) {
    status = "needs_attention";
    statusHeadline = "A few items need attention";
  } else {
    status = "on_track";
    statusHeadline = "Manageable debt picture";
  }

  const summary = noDebt
    ? "You reported no outstanding debt balances. Your focus can shift to saving and investing."
    : `You have about $${total.toLocaleString()} in total debt across your accounts. ${
        positiveCashFlow
          ? `With $${input.monthlySurplus.toLocaleString()} monthly surplus, you have room to make progress.`
          : "Improving cash flow would make payoff easier."
      }`;

  const context: StructuredAssessment["context"] = [
    {
      label: "Total debt",
      detail: noDebt ? "None reported" : `$${total.toLocaleString()}`,
    },
    {
      label: "Emergency fund",
      detail: `$${input.emergencyFund.toLocaleString()}`,
    },
    {
      label: "Monthly surplus",
      detail:
        input.monthlySurplus > 0
          ? `$${input.monthlySurplus.toLocaleString()}`
          : input.monthlySurplus < 0
            ? `-$${Math.abs(input.monthlySurplus).toLocaleString()} (deficit)`
            : "$0",
    },
  ];

  if (hasBalance(input.creditCard)) {
    context.push({
      label: "Credit card",
      detail: `$${input.creditCard.balance.toLocaleString()} at ${input.creditCard.interestRatePct}%`,
    });
  }

  return {
    title: "Debt assessment",
    status,
    statusHeadline,
    summary,
    wins,
    watchAreas,
    context,
    contextTitle: "Your debt snapshot",
    recommendedNextStep,
  };
}

export function formatDebtAssessmentAnswer(input: DebtAssessmentInput): string {
  return formatAssessmentAnswer(buildDebtStructuredAssessment(input));
}
