import {
  formatAssessmentAnswer,
  type StructuredAssessment,
} from "@/lib/assessment-types";
import {
  buildLongTermImpact,
  computeBigPurchaseMetrics,
  type ImpactMetric,
} from "@/lib/big-purchase-impact";
import { bigPurchaseSpec } from "@/lib/specs/bundle";

export type PurchaseTypeId =
  | "house"
  | "vehicle"
  | "home_renovation"
  | "college_education"
  | "daycare_childcare"
  | "rental_property"
  | "business_investment"
  | "other";

export type BigPurchaseAssessmentInput = {
  purchaseType: PurchaseTypeId;
  purchasePrice: number;
  downPayment: number;
  householdAnnualIncome: number;
  monthlySavings: number;
  emergencyFundBalance: number;
  existingDebtPayments: number;
  expectedMonthlyPayment: number;
  expectedFinancingAmount: number;
};

export type DecisionCategory = "comfortable" | "stretch" | "risky";

export type BigPurchaseAssessmentResult = {
  assessment: StructuredAssessment;
  category: DecisionCategory;
  categoryLabel: string;
  categoryHeadline: string;
  categoryDescription: string;
  metrics: ReturnType<typeof computeBigPurchaseMetrics>;
  longTermImpact: ImpactMetric[];
  opportunityCost: { label: string; detail: string }[];
  reflectionQuestions: string[];
};

const STARTER_EF = bigPurchaseSpec.constants.starter_emergency_fund_target;
const RULES = bigPurchaseSpec.rules;

function purchaseTypeLabel(id: PurchaseTypeId): string {
  return (
    bigPurchaseSpec.purchase_types.find((t) => t.id === id)?.label ?? "Purchase"
  );
}

function deriveCategory(score: number): DecisionCategory {
  if (score <= RULES.category_comfortable_max_score) return "comfortable";
  if (score <= RULES.category_stretch_max_score) return "stretch";
  return "risky";
}

function mapStatus(category: DecisionCategory): StructuredAssessment["status"] {
  if (category === "comfortable") return "on_track";
  if (category === "stretch") return "needs_attention";
  return "not_ready";
}

function buildOpportunityCost(
  input: BigPurchaseAssessmentInput,
  metrics: ReturnType<typeof computeBigPurchaseMetrics>
): { label: string; detail: string }[] {
  const bullets: { label: string; detail: string }[] = [];
  const oc = bigPurchaseSpec.opportunity_cost;

  const paymentReduction = input.expectedMonthlyPayment;
  if (paymentReduction > 0) {
    bullets.push({
      label: "Investing capacity",
      detail: oc.investing_capacity.replace(
        "{amount}",
        `$${Math.round(paymentReduction).toLocaleString()}`
      ),
    });
  }

  if (metrics.postPurchaseCashFlow < input.monthlySavings * 0.5) {
    bullets.push({
      label: "Debt payoff",
      detail: oc.debt_payoff_delay,
    });
  }

  if (
    metrics.postPurchaseCashFlow < input.monthlySavings ||
    metrics.postPurchaseEFMonths < RULES.min_ef_months_comfortable
  ) {
    bullets.push({
      label: "Flexibility",
      detail: oc.flexibility_reduction,
    });
  }

  if (metrics.postPurchaseCashFlow < input.monthlySavings) {
    bullets.push({
      label: "Savings growth",
      detail: oc.savings_growth_slow,
    });
  }

  if (input.downPayment >= STARTER_EF && input.downPayment > input.emergencyFundBalance * 0.5) {
    bullets.push({
      label: "Reserves",
      detail: oc.reserve_depletion,
    });
  }

  return bullets;
}

function pickNextStep(
  category: DecisionCategory,
  input: BigPurchaseAssessmentInput,
  metrics: ReturnType<typeof computeBigPurchaseMetrics>
): string {
  const steps = bigPurchaseSpec.assessment.next_steps;

  if (category === "comfortable") return steps.proceed_comfortably;
  if (category === "stretch") return steps.proceed_with_awareness;

  if (metrics.dtiPct > RULES.risky_dti_pct || input.existingDebtPayments / metrics.monthlyIncome > 0.3) {
    return steps.focus_debt_reduction;
  }
  if (metrics.postPurchaseEFMonths < RULES.min_ef_months_risky) {
    return steps.increase_savings;
  }
  if (metrics.postPurchaseCashFlow < 0) {
    return steps.delay_purchase;
  }
  if (
    metrics.financingRatioPct > RULES.max_financing_ratio_stretch ||
    metrics.downPaymentPct < RULES.min_down_payment_pct_stretch
  ) {
    return steps.reduce_purchase_size;
  }
  return steps.delay_purchase;
}

export function buildBigPurchaseAssessment(
  input: BigPurchaseAssessmentInput
): BigPurchaseAssessmentResult {
  const metrics = computeBigPurchaseMetrics(input);
  const category = deriveCategory(metrics.categoryScore);
  const catMeta = bigPurchaseSpec.categories[category];
  const wins: StructuredAssessment["wins"] = [];
  const watchAreas: StructuredAssessment["watchAreas"] = [];
  const winsCopy = bigPurchaseSpec.assessment.wins;
  const watchCopy = bigPurchaseSpec.assessment.watch;

  if (input.emergencyFundBalance >= STARTER_EF) {
    wins.push({
      label: winsCopy.emergency_fund_established,
      detail: `Your emergency fund of $${input.emergencyFundBalance.toLocaleString()} meets the starter target (~$${STARTER_EF.toLocaleString()}).`,
    });
  }

  if (input.monthlySavings > 0) {
    wins.push({
      label: winsCopy.positive_monthly_savings,
      detail: `You save about $${input.monthlySavings.toLocaleString()} per month — positive cash flow supports new commitments.`,
    });
  }

  const existingDtiPct =
    metrics.monthlyIncome > 0
      ? (input.existingDebtPayments / metrics.monthlyIncome) * 100
      : 0;
  if (existingDtiPct <= RULES.comfortable_max_dti_pct * 0.6) {
    wins.push({
      label: winsCopy.low_debt_burden,
      detail: `Existing debt payments are about ${existingDtiPct.toFixed(1)}% of income — relatively low before this purchase.`,
    });
  }

  if (metrics.downPaymentPct >= RULES.min_down_payment_pct_comfortable) {
    wins.push({
      label: winsCopy.strong_down_payment,
      detail: `A ${metrics.downPaymentPct.toFixed(0)}% down payment reduces financing and monthly burden.`,
    });
  }

  if (
    category === "comfortable" &&
    metrics.postPurchaseCashFlow >= input.monthlySavings * 0.75
  ) {
    wins.push({
      label: winsCopy.purchase_funded_comfortably,
      detail: "After this purchase, you would still have meaningful monthly surplus and reserves.",
    });
  }

  if (
    metrics.postPurchaseEF >= STARTER_EF &&
    metrics.postPurchaseEFMonths >= RULES.min_ef_months_stretch
  ) {
    wins.push({
      label: winsCopy.healthy_cash_reserves,
      detail: `About ${metrics.postPurchaseEFMonths.toFixed(1)} months of essentials would remain covered after purchase.`,
    });
  }

  if (metrics.paymentToIncomePct > RULES.comfortable_max_payment_pct) {
    watchAreas.push({
      label: watchCopy.payment_strains_cash_flow,
      detail: `The expected payment is about ${metrics.paymentToIncomePct.toFixed(1)}% of gross monthly income (comfortable threshold: ≤${RULES.comfortable_max_payment_pct}%).`,
    });
  }

  if (metrics.postPurchaseEFMonths < RULES.min_ef_months_comfortable) {
    watchAreas.push({
      label: watchCopy.emergency_fund_small,
      detail: `After purchase, reserves cover about ${metrics.postPurchaseEFMonths.toFixed(1)} months of essentials (target: ≥${RULES.min_ef_months_comfortable} months).`,
    });
  }

  if (existingDtiPct > RULES.comfortable_max_dti_pct * 0.7) {
    watchAreas.push({
      label: watchCopy.existing_debt_high,
      detail: `Existing debt payments are already about ${existingDtiPct.toFixed(1)}% of income before adding this purchase.`,
    });
  }

  if (metrics.financingRatioPct > RULES.max_financing_ratio_comfortable) {
    watchAreas.push({
      label: watchCopy.substantial_financing,
      detail: `About ${metrics.financingRatioPct.toFixed(0)}% of the purchase would be financed — a larger upfront payment could reduce ongoing burden.`,
    });
  }

  if (metrics.postPurchaseCashFlow < input.monthlySavings * 0.5) {
    watchAreas.push({
      label: watchCopy.savings_goals_slow,
      detail: `Monthly surplus could drop from $${input.monthlySavings.toLocaleString()} to $${Math.round(metrics.postPurchaseCashFlow).toLocaleString()} — savings and investing may slow.`,
    });
  }

  const recommendedNextStep = pickNextStep(category, input, metrics);
  const typeLabel = purchaseTypeLabel(input.purchaseType);

  const summary =
    category === "comfortable"
      ? `Your ${typeLabel.toLowerCase()} purchase of $${input.purchasePrice.toLocaleString()} appears manageable based on income, savings, and debt levels.`
      : category === "stretch"
        ? `Your ${typeLabel.toLowerCase()} purchase of $${input.purchasePrice.toLocaleString()} is possible but involves meaningful tradeoffs in cash flow or reserves.`
        : `Your ${typeLabel.toLowerCase()} purchase of $${input.purchasePrice.toLocaleString()} may significantly strain cash flow, reserves, or debt burden.`;

  const assessment: StructuredAssessment = {
    title: "Big purchase assessment",
    status: mapStatus(category),
    statusHeadline: catMeta.headline,
    summary,
    wins,
    watchAreas,
    context: [
      {
        label: "Purchase type",
        detail: typeLabel,
      },
      {
        label: "Purchase price",
        detail: `$${input.purchasePrice.toLocaleString()}`,
      },
      {
        label: "Payment / income",
        detail: `${metrics.paymentToIncomePct.toFixed(1)}%`,
      },
      {
        label: "Total debt / income",
        detail: `${metrics.dtiPct.toFixed(1)}%`,
      },
      {
        label: "Down payment",
        detail: `${metrics.downPaymentPct.toFixed(0)}% ($${input.downPayment.toLocaleString()})`,
      },
      {
        label: "Financing ratio",
        detail: `${metrics.financingRatioPct.toFixed(0)}%`,
      },
    ],
    contextTitle: "Your purchase snapshot",
    recommendedNextStep,
  };

  return {
    assessment,
    category,
    categoryLabel: catMeta.label,
    categoryHeadline: catMeta.headline,
    categoryDescription: catMeta.description,
    metrics,
    longTermImpact: buildLongTermImpact(input, metrics),
    opportunityCost: buildOpportunityCost(input, metrics),
    reflectionQuestions: [...bigPurchaseSpec.reflection_questions],
  };
}

export function formatBigPurchaseAssessmentAnswer(
  input: BigPurchaseAssessmentInput
): string {
  return formatAssessmentAnswer(buildBigPurchaseAssessment(input).assessment);
}
