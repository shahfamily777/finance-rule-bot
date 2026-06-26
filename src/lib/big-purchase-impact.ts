import { bigPurchaseSpec } from "@/lib/specs/bundle";
import type { BigPurchaseAssessmentInput } from "@/lib/big-purchase-assess";

export type ImpactMetric = {
  label: string;
  before: string;
  after: string;
  note?: string;
};

export type BigPurchaseMetrics = {
  monthlyIncome: number;
  paymentToIncomePct: number;
  dtiPct: number;
  downPaymentPct: number;
  financingRatioPct: number;
  postPurchaseEF: number;
  postPurchaseEFMonths: number;
  postPurchaseCashFlow: number;
  essentialMonthlySpend: number;
  totalDebtPayments: number;
  categoryScore: number;
};

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function computeBigPurchaseMetrics(
  input: BigPurchaseAssessmentInput
): BigPurchaseMetrics {
  const monthlyIncome = input.householdAnnualIncome / 12;
  const paymentToIncomePct =
    monthlyIncome > 0 ? (input.expectedMonthlyPayment / monthlyIncome) * 100 : 0;
  const totalDebtPayments = input.existingDebtPayments + input.expectedMonthlyPayment;
  const dtiPct = monthlyIncome > 0 ? (totalDebtPayments / monthlyIncome) * 100 : 0;
  const downPaymentPct =
    input.purchasePrice > 0 ? (input.downPayment / input.purchasePrice) * 100 : 0;
  const financingRatioPct =
    input.purchasePrice > 0
      ? (input.expectedFinancingAmount / input.purchasePrice) * 100
      : 0;

  const postPurchaseEF = Math.max(0, input.emergencyFundBalance);
  const essentialMonthlySpend = Math.max(
    monthlyIncome - input.monthlySavings,
    monthlyIncome * 0.5
  );
  const postPurchaseEFMonths =
    essentialMonthlySpend > 0 ? postPurchaseEF / essentialMonthlySpend : 0;
  const postPurchaseCashFlow = input.monthlySavings - input.expectedMonthlyPayment;

  const rules = bigPurchaseSpec.rules;
  let categoryScore = 0;

  if (paymentToIncomePct > rules.risky_payment_pct) categoryScore += 3;
  else if (paymentToIncomePct > rules.stretch_max_payment_pct) categoryScore += 2;
  else if (paymentToIncomePct > rules.comfortable_max_payment_pct) categoryScore += 1;

  if (dtiPct > rules.risky_dti_pct) categoryScore += 3;
  else if (dtiPct > rules.stretch_max_dti_pct) categoryScore += 2;
  else if (dtiPct > rules.comfortable_max_dti_pct) categoryScore += 1;

  if (postPurchaseEFMonths < rules.min_ef_months_risky) categoryScore += 3;
  else if (postPurchaseEFMonths < rules.min_ef_months_stretch) categoryScore += 2;
  else if (postPurchaseEFMonths < rules.min_ef_months_comfortable) categoryScore += 1;

  if (postPurchaseCashFlow < 0) categoryScore += 2;
  else if (postPurchaseCashFlow < input.monthlySavings * 0.25) categoryScore += 1;

  if (financingRatioPct > rules.max_financing_ratio_risky) categoryScore += 2;
  else if (financingRatioPct > rules.max_financing_ratio_stretch) categoryScore += 1;

  if (downPaymentPct < rules.min_down_payment_pct_stretch) categoryScore += 1;

  return {
    monthlyIncome,
    paymentToIncomePct,
    dtiPct,
    downPaymentPct,
    financingRatioPct,
    postPurchaseEF,
    postPurchaseEFMonths,
    postPurchaseCashFlow,
    essentialMonthlySpend,
    totalDebtPayments,
    categoryScore,
  };
}

export function buildLongTermImpact(
  input: BigPurchaseAssessmentInput,
  metrics: BigPurchaseMetrics
): ImpactMetric[] {
  const { monthlyIncome } = metrics;
  const savingsRateBefore =
    monthlyIncome > 0 ? (input.monthlySavings / monthlyIncome) * 100 : 0;
  const savingsRateAfter =
    monthlyIncome > 0 ? (metrics.postPurchaseCashFlow / monthlyIncome) * 100 : 0;
  const existingDtiPct =
    monthlyIncome > 0 ? (input.existingDebtPayments / monthlyIncome) * 100 : 0;

  const flexibilityBefore =
    input.monthlySavings > 0 && metrics.postPurchaseEFMonths >= 3
      ? "Good"
      : input.monthlySavings > 0
        ? "Moderate"
        : "Limited";
  const flexibilityAfter =
    metrics.postPurchaseCashFlow > input.monthlySavings * 0.5 &&
    metrics.postPurchaseEFMonths >= 2
      ? "Good"
      : metrics.postPurchaseCashFlow >= 0
        ? "Moderate"
        : "Limited";

  return [
    {
      label: "Monthly cash flow",
      before: fmt(input.monthlySavings) + "/mo surplus",
      after: fmt(metrics.postPurchaseCashFlow) + "/mo surplus",
      note:
        metrics.postPurchaseCashFlow < input.monthlySavings
          ? `About ${fmt(input.monthlySavings - metrics.postPurchaseCashFlow)}/mo redirected to this purchase`
          : undefined,
    },
    {
      label: "Emergency fund",
      before: fmt(input.emergencyFundBalance),
      after: fmt(metrics.postPurchaseEF),
      note:
        metrics.postPurchaseEFMonths > 0
          ? `~${metrics.postPurchaseEFMonths.toFixed(1)} months of essentials after purchase`
          : undefined,
    },
    {
      label: "Savings rate",
      before: fmtPct(savingsRateBefore) + " of income",
      after: fmtPct(Math.max(0, savingsRateAfter)) + " of income",
    },
    {
      label: "Investing ability",
      before:
        input.monthlySavings > 0
          ? fmt(input.monthlySavings) + "/mo available"
          : "Limited room",
      after:
        metrics.postPurchaseCashFlow > 0
          ? fmt(metrics.postPurchaseCashFlow) + "/mo available"
          : "Limited or none",
    },
    {
      label: "Debt burden",
      before: fmtPct(existingDtiPct) + " of income",
      after: fmtPct(metrics.dtiPct) + " of income",
    },
    {
      label: "Financial flexibility",
      before: flexibilityBefore,
      after: flexibilityAfter,
    },
  ];
}
