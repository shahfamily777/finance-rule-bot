import { debtSpec } from "@/lib/specs/bundle";

export type InvestingStatus = {
  has401kMatch: boolean;
  hasEmergencyFund: boolean;
};

export type DebtVsInvestingRecommendation = {
  strategy: "focus_debt" | "mixed" | "consider_investing";
  headline: string;
  reasoning: string;
  contextNotes: string[];
};

const rules = debtSpec.debt_vs_investing;
const thresholds = debtSpec.rules;

export function recommendDebtVsInvesting(
  debtInterestRatePct: number,
  monthlySurplus: number,
  status: InvestingStatus
): DebtVsInvestingRecommendation {
  const contextNotes: string[] = [];

  if (status.has401kMatch) {
    contextNotes.push(
      "If you have a 401(k) employer match, capturing the full match is usually worth doing before extra debt payments beyond minimums."
    );
  } else {
    contextNotes.push(
      "Without an employer match, there is less reason to prioritize investing before higher-rate debt."
    );
  }

  if (!status.hasEmergencyFund) {
    contextNotes.push(
      `A starter emergency fund (~$${debtSpec.constants.starter_emergency_fund_target.toLocaleString()}) helps prevent new debt when surprises happen.`
    );
  } else {
    contextNotes.push("Having an emergency fund in place reduces the risk of taking on new debt.");
  }

  if (monthlySurplus <= 0) {
    contextNotes.push(
      "With no monthly surplus, focus on increasing income or reducing expenses before splitting money between debt and investing."
    );
  }

  if (debtInterestRatePct >= thresholds.debt_vs_invest_focus_debt_pct) {
    return {
      strategy: "focus_debt",
      headline: rules.focus_debt.headline,
      reasoning: rules.focus_debt.reasoning.trim(),
      contextNotes,
    };
  }

  if (debtInterestRatePct >= thresholds.debt_vs_invest_mixed_low_pct) {
    return {
      strategy: "mixed",
      headline: rules.mixed.headline,
      reasoning: rules.mixed.reasoning.trim(),
      contextNotes,
    };
  }

  return {
    strategy: "consider_investing",
    headline: rules.consider_investing.headline,
    reasoning: rules.consider_investing.reasoning.trim(),
    contextNotes,
  };
}
