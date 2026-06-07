import {
  formatAssessmentAnswer,
  type StructuredAssessment,
} from "@/lib/assessment-types";
import type { ConversationState } from "@/lib/conversation";

const STARTER_EF_TARGET = 2000;

export function buildInvestmentStructuredAssessment(
  state: ConversationState
): StructuredAssessment {
  const d = state.data;
  const investText =
    d.investAmount !== null ? `$${d.investAmount.toLocaleString()}` : "your next dollars";

  const steps: { label: string; detail: string }[] = [
    {
      label: "1. Employer match",
      detail: d.has401kMatch
        ? "Capture the full 401(k) match if you have one."
        : "If a match exists at work, prioritize it first.",
    },
    {
      label: "2. Starter emergency fund",
      detail: d.hasStarterEmergencyFund
        ? `Keep at least ~$${STARTER_EF_TARGET.toLocaleString()} set aside.`
        : `Build ~$${STARTER_EF_TARGET.toLocaleString()} before extra investing.`,
    },
    {
      label: "3. High-interest debt",
      detail: d.hasHighInterestDebt
        ? "Pay aggressive high-interest debt before extra long-term investing."
        : "No high-interest debt blocking the path — move to the next step.",
    },
    {
      label: "4. Full emergency fund",
      detail: d.hasFullEmergencyFund
        ? "Maintain 3–6 months of expenses in cash."
        : "Grow toward a full 3–6 month emergency fund.",
    },
    {
      label: "5. HSA",
      detail: d.hsaEligible
        ? "If eligible, consider HSA contributions (triple tax advantage)."
        : "Skip HSA if you’re not on an eligible HDHP.",
    },
    {
      label: "6. Roth IRA",
      detail: d.hasRothIra
        ? "Continue IRA contributions as appropriate."
        : "Consider funding a Roth (or Traditional) IRA if eligible.",
    },
    {
      label: "7. Max 401(k)",
      detail: d.maxing401k
        ? "You’re at or near max 401(k) — good."
        : "Increase 401(k) toward the annual limit when cash flow allows.",
    },
    {
      label: "8. Taxable investing",
      detail: "Long-term extra money → diversified, low-cost index funds in a brokerage account.",
    },
  ];

  const blockers: string[] = [];
  if (!d.hasStarterEmergencyFund) blockers.push("starter emergency fund");
  if (d.hasHighInterestDebt) blockers.push("high-interest debt");
  if (!d.hasFullEmergencyFund) blockers.push("full emergency fund");

  const onTrack = blockers.length === 0;

  const wins: StructuredAssessment["wins"] = [];
  if (d.has401kMatch) {
    wins.push({
      label: "Capturing your employer 401(k) match",
      detail:
        "Capturing your employer match is one of the most valuable retirement benefits available — it's an immediate return on every dollar you contribute.",
    });
  }
  if (!d.hasHighInterestDebt) {
    wins.push({
      label: "No high-interest debt",
      detail:
        "Being debt-free gives you more flexibility to save, invest, and handle unexpected expenses, and removes a guaranteed drag on your money.",
    });
  }
  if (d.hasStarterEmergencyFund) {
    wins.push({
      label: "Starter emergency fund in place",
      detail:
        "A starter cushion provides protection against small surprises, so an unexpected cost doesn't immediately turn into debt.",
    });
  }
  if (d.hasFullEmergencyFund) {
    wins.push({
      label: "Full emergency fund established",
      detail:
        "Three to six months of expenses in accessible cash is strong protection — it reduces long-term risk and lets you invest with a steadier hand.",
    });
  }
  if (d.hasRothIra) {
    wins.push({
      label: "Contributing to a Roth IRA",
      detail:
        "Consistent, tax-advantaged investing allows compounding to work over long periods of time.",
    });
  }
  if (d.maxing401k) {
    wins.push({
      label: "Maxing your 401(k)",
      detail:
        "Contributing near the annual limit puts more money to work in a tax-advantaged account each year.",
    });
  }

  const watchAreas: StructuredAssessment["watchAreas"] = [];
  if (d.hasHighInterestDebt) {
    watchAreas.push({
      label: "High-interest debt",
      detail:
        "Paying this down before extra long-term investing usually wins, because the interest is a guaranteed cost that's hard to beat in the market.",
      pass: false,
    });
  }
  if (!d.hasStarterEmergencyFund) {
    watchAreas.push({
      label: "Starter emergency fund incomplete",
      detail: `A small cushion (about $${STARTER_EF_TARGET.toLocaleString()}) comes before extra investing so a surprise cost doesn't force you to sell or borrow.`,
      pass: false,
    });
  }
  if (!d.hasFullEmergencyFund) {
    watchAreas.push({
      label: "Emergency fund is incomplete",
      detail:
        "Growing toward 3–6 months of expenses strengthens your safety net before taking on more market risk.",
      pass: false,
    });
  }
  if (!d.maxing401k && onTrack) {
    watchAreas.push({
      label: "Retirement savings could improve",
      detail:
        "Once your safety layers are in place, increasing 401(k) contributions toward the annual limit is a strong next move.",
      pass: false,
    });
  }

  let recommendedNextStep: string;
  if (!d.hasStarterEmergencyFund) {
    recommendedNextStep = `Build a starter emergency fund (about $${STARTER_EF_TARGET.toLocaleString()}) before increasing other investments.`;
  } else if (d.hasHighInterestDebt) {
    recommendedNextStep =
      "Pay down high-interest debt before pushing extra dollars into long-term investing.";
  } else if (!d.hasFullEmergencyFund) {
    recommendedNextStep =
      "Complete your full emergency fund (3–6 months of expenses) before increasing investments.";
  } else if (!d.hasRothIra) {
    recommendedNextStep =
      "Consider opening and funding a Roth IRA as your next tax-advantaged step.";
  } else if (!d.maxing401k) {
    recommendedNextStep =
      "Increase your 401(k) contributions toward the annual limit when cash flow allows.";
  } else {
    recommendedNextStep =
      "Direct additional long-term money into diversified, low-cost index funds in a taxable brokerage.";
  }

  return {
    title: "Investment priority plan",
    status: onTrack ? "on_track" : "needs_attention",
    statusHeadline: onTrack
      ? "Your answers support moving down the priority list"
      : `Focus first on: ${blockers.join(", ")}`,
    summary: `This order is fixed — it’s not stock picking. For ${investText}, work the steps in sequence so each layer of safety is in place before you take more market risk.`,
    wins,
    watchAreas,
    context: steps.map((s) => ({ label: s.label, detail: s.detail })),
    contextTitle: "Your priority order",
    recommendedNextStep,
  };
}

export function investmentAssessmentAnswer(state: ConversationState): string {
  return formatAssessmentAnswer(buildInvestmentStructuredAssessment(state));
}
