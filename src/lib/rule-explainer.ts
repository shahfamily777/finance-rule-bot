/**
 * Calm, human explanations of fixed rules.
 * Fully deterministic — rules decide outcomes and these canned answers explain
 * why and what to do next. No external model is called.
 * Behavior spec: specs/ai-behavior.yaml
 */

import { buildCarLoanStructuredAssessment } from "@/lib/assessment-car";
import type { CarLoanConversationState } from "@/lib/car-loan-flow";
import { buildMortgageStructuredAssessment } from "@/lib/assessment-mortgage";
import type { MortgageConversationState } from "@/lib/mortgage-flow";
import { buildInvestmentStructuredAssessment } from "@/lib/assessment-investment";
import type { ConversationState } from "@/lib/conversation";
import {
  isUserAskingQuestion,
  type TopicId,
} from "@/lib/section-qa";
import { explainDebtQuestion } from "@/lib/debt/explainer";

export type ExplainThreadMsg = { role: "user" | "assistant"; content: string };

/** Use AI (or fallback prose) instead of a one-line rule snippet. */
export function prefersExplainerAnswer(text: string, topic: TopicId): boolean {
  const t = text.trim();
  if (!t) return false;

  if (topic === "car-loan") {
    if (
      /too\s+long/i.test(t) &&
      /\b(60|72|84|96)\b/.test(t) &&
      !/\b(why|explain|help me understand|compare)\b/i.test(t)
    ) {
      return false;
    }
    if (/(?:what\s+are\s+(?:the\s+)?rules|your\s+three\s+rules)/i.test(t)) {
      return false;
    }
  }

  const guidedFollowUp =
    /\bwhy\s+is\s+this\s+risky\b/i.test(t) ||
    /\bcompare\b/i.test(t) && /\b(48|72|60)\b/i.test(t) ||
    /\bwhat\s+payment\s+is\s+safer\b/i.test(t) ||
    /\bwhat\s+if\s+(?:my\s+)?income\b/i.test(t) ||
    /\bexplain\s+(?:my\s+)?(?:assessment|result|checklist)\b/i.test(t);

  if (guidedFollowUp) return true;

  const wantsGuidance =
    isUserAskingQuestion(t) ||
    /\b(don't|do not|can't|cannot|not enough|help me|what should i|what do i do)\b/i.test(
      t
    );

  if (!wantsGuidance) return false;

  return (
    /\b(why|how come|explain|help me understand|make sense|confused|risky|tradeoff|stress)\b/i.test(
      t
    ) ||
    /\b(why|how come).{0,50}(48|four year|longer|beyond|more than|maximum|max)\b/i.test(
      t
    ) ||
    /\b(beyond|over|more than|longer than)\s*48\b/i.test(t) ||
    /\b(don't|do not|can't|cannot|not enough).{0,60}(down|afford|payment|month|48)/i.test(
      t
    ) ||
    /\bwhat\s+should\s+i\s+do\b/i.test(t) ||
    /\bif\s+i\s+(?:can't|cannot|don't)\b/i.test(t) ||
    /\bsafer\b/i.test(t)
  );
}

/** Short numeric reply to a prior assistant question (not a form resubmit). */
export function isConversationalNumericReply(
  text: string,
  thread: ExplainThreadMsg[]
): boolean {
  const t = text.trim();
  if (!/^\$?\s*[\d,]+(?:\.\d+)?\s*(?:k|m)?$/i.test(t)) return false;
  const lastAssistant = [...thread].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant) return false;
  return (
    /\?/.test(lastAssistant.content) &&
    /\b(down|putting|how much|income|price|insurance|payment|term|months?)\b/i.test(
      lastAssistant.content
    )
  );
}

function summarizeState(topic: TopicId, state: unknown): string {
  if (!state || typeof state !== "object") return "(No saved numbers yet.)";

  try {
    if (topic === "car-loan") {
      const s = state as CarLoanConversationState;
      const d = s.data;
      const lines: string[] = [];
      if (d.vehiclePrice != null)
        lines.push(`Vehicle price: $${d.vehiclePrice.toLocaleString()}`);
      if (d.downPayment != null)
        lines.push(`Down payment: $${d.downPayment.toLocaleString()}`);
      if (d.loanTermMonths != null) lines.push(`Loan term: ${d.loanTermMonths} months`);
      if (d.grossMonthlyIncome != null)
        lines.push(`Gross monthly income: $${d.grossMonthlyIncome.toLocaleString()}`);
      if (d.annualInterestRatePct != null) lines.push(`APR: ${d.annualInterestRatePct}%`);
      if (d.monthlyCarPayment != null)
        lines.push(`Estimated payment: $${d.monthlyCarPayment.toLocaleString()}/mo`);
      if (lines.length === 0) return "(No saved numbers yet.)";
      const assessment = buildCarLoanStructuredAssessment(s);
      return (
        lines.join("\n") +
        `\nChecklist status: ${assessment.statusHeadline}\nSummary: ${assessment.summary}`
      );
    }
    if (topic === "mortgage") {
      const s = state as MortgageConversationState;
      const d = s.data;
      const lines: string[] = [];
      if (d.isRefinance) lines.push("Scenario: refinance");
      else if (d.homePrice != null)
        lines.push(`Home price: $${d.homePrice.toLocaleString()}`);
      if (d.grossMonthlyIncome != null)
        lines.push(`Gross monthly income: $${d.grossMonthlyIncome.toLocaleString()}`);
      if (d.downPayment != null)
        lines.push(`Down payment: $${d.downPayment.toLocaleString()}`);
      if (lines.length === 0) return "(No saved numbers yet.)";
      const assessment = buildMortgageStructuredAssessment(s);
      return (
        lines.join("\n") +
        `\nChecklist status: ${assessment.statusHeadline}\nSummary: ${assessment.summary}`
      );
    }
    const s = state as ConversationState;
    const assessment = buildInvestmentStructuredAssessment(s);
    return `Investment priority plan status: ${assessment.statusHeadline}\nSummary: ${assessment.summary}`;
  } catch {
    return "(Could not read saved numbers.)";
  }
}

function savedNumbersBlock(stateSummary: string, marker: string): string {
  return stateSummary.includes(marker)
    ? `\n\nWith your saved numbers:\n${stateSummary}`
    : "";
}

function explainCarLoan(
  t: string,
  stateSummary: string,
  thread: ExplainThreadMsg[]
): string | null {
  if (/\brisky\b|why.*risk/i.test(t)) {
    return (
      "Risk here usually means **monthly pressure** — loan payment, insurance, and fuel eating too much of gross income, or a loan term that outlasts the car's value.\n\n" +
      "Our rules cap stress at **10% transportation** of gross income and **48 months** max. Longer loans feel easier month to month but cost more overall and often leave you **upside-down** (owing more than the car is worth)." +
      savedNumbersBlock(stateSummary, "Checklist")
    );
  }

  if (/\bcompare\b/i.test(t) && /\b(48|72|60)\b/i.test(t)) {
    return (
      "**48 months** is our maximum — acceptable, and usually less total interest than longer terms.\n\n" +
      "**60 or 72 months** lower the monthly payment but increase total cost and upside-down risk. This app **does not** use or recommend them.\n\n" +
      "If 48 months feels tight, the fix is a lower price, more down, or a better rate — not a longer term."
    );
  }

  if (/safer\s+payment|what\s+payment.*safe|payment.*safer/i.test(t)) {
    return (
      "A payment is **safe** here when loan payment + insurance + gas/charging together stay at or under **10% of your gross monthly income**.\n\n" +
      "So take your gross monthly income × 10%, subtract insurance and fuel, and what's left is the most your **loan payment** should be. If your real payment (at 48 months or less and your APR) is above that, lower the price or put more down." +
      savedNumbersBlock(stateSummary, "Vehicle")
    );
  }

  if (
    /income.*(increase|grow|goes up|higher|raise)/i.test(t) ||
    /(if|when).*income/i.test(t)
  ) {
    return (
      "Higher income raises your **10% transportation budget**, so a given car becomes easier to fit — but the other two rules don't move: still **≥20% down** and **≤48 months**.\n\n" +
      "If a raise is the only reason a car fits, it's worth waiting until the income is actually steady before stretching, rather than counting on it." +
      savedNumbersBlock(stateSummary, "Vehicle")
    );
  }

  if (isConversationalNumericReply(t, thread)) {
    const raw = t.replace(/,/g, "").replace(/^\$/, "");
    const n = Number(raw.replace(/k$/i, "000"));
    const amt = Number.isFinite(n) ? n : null;
    const lastAssistant = [...thread].reverse().find((m) => m.role === "assistant");
    if (amt !== null && lastAssistant && /down|putting/i.test(lastAssistant.content)) {
      return (
        `Got it — **$${amt.toLocaleString()}** down.\n\n` +
        "That's separate from the **48-month term cap** (48 months is the longest loan we allow, not a down-payment program).\n\n" +
        "Next, compare that down payment to **20% of the car price**. If the **monthly payment at 48 months or less** still busts the **10% transportation** rule, the usual fixes are a lower purchase price, saving more for down, a better rate, or waiting — not a 60- or 72-month loan." +
        savedNumbersBlock(stateSummary, "Vehicle")
      );
    }
  }

  if (/\bwhy\b/i.test(t) && /\b(48|four year|longer|beyond|more than|maximum)\b/i.test(t)) {
    return (
      "We keep car loans at **48 months or less** because the car loses value much faster than the loan balance drops on long terms — that's how people end up upside-down and stuck.\n\n" +
      "That rule isn't negotiable in this app, but **shorter** than 48 is fine. If 48 months still feels tight, it usually means the car, down payment, or rate needs adjusting — not a 60- or 72-month loan." +
      savedNumbersBlock(stateSummary, "Vehicle") +
      "\n\nPractical levers: more down, a lower purchase price, a lower APR, or waiting until cash flow is clearer."
    );
  }

  if (/\b(not enough|don't have enough|can't).{0,40}down\b/i.test(t) && /\b48\b/i.test(t)) {
    return (
      "It sounds like two ideas got tangled: **48 months** is the **longest loan term** we allow — it isn't a down-payment amount or a special program.\n\n" +
      "If the **payment** at 48 months feels too high, that's separate from the **20% down** rule. You can:\n" +
      "• Save toward more down (reduces the loan and payment)\n" +
      "• Choose a less expensive car\n" +
      "• Shop for a better APR\n" +
      "• Wait until the numbers fit — we don't extend past 48 months to make the payment work" +
      savedNumbersBlock(stateSummary, "Down payment")
    );
  }

  if (/\bwhat should i do\b/i.test(t) && /down|48|payment|afford/i.test(t)) {
    return (
      "A calm order of operations:\n" +
      "1) Confirm the **price** and whether **20% down** is realistic (or how far you are from it).\n" +
      "2) Run the payment at **48 months or less** with your real APR — if it's over **10% of gross income** with insurance and fuel, the car is probably too expensive for now.\n" +
      "3) Adjust price, down, or timing — not the term past 48 months.\n\n" +
      "Use **Update your numbers** to change what's saved and see an updated assessment."
    );
  }

  return null;
}

function explainMortgage(t: string, stateSummary: string): string | null {
  if (/\brisky\b|why.*risk/i.test(t)) {
    return (
      "Risk here is mostly **monthly rigidity** — housing costs that leave little room if income dips, plus buying without cash reserves for the down payment, closing, and emergencies.\n\n" +
      "That's why we keep total housing (principal & interest + property tax + insurance + HOA/maintenance) at **≤35% of gross income**, and require **20% down + closing costs + a funded emergency fund in cash** before buying — not stretching to the approval maximum." +
      savedNumbersBlock(stateSummary, "Checklist")
    );
  }

  if (
    /max.*(home|house|price|afford)/i.test(t) ||
    /how.*(calculate|work out|get).*price/i.test(t) ||
    /35\s*%/i.test(t)
  ) {
    return (
      "The **max affordable price** is the highest price where total monthly housing still fits **35% of your gross income**.\n\n" +
      "We take 35% of your gross monthly income as the housing ceiling, then solve for the price whose **principal & interest** (at your rate, term, and down payment) plus **property tax, insurance, and HOA** lands at or just under that ceiling.\n\n" +
      "Raising income, putting more down, a lower rate, or a shorter price all push that number up." +
      savedNumbersBlock(stateSummary, "Checklist")
    );
  }

  if (/rent/i.test(t) || /instead of buying|keep renting|ready to buy/i.test(t)) {
    return (
      "Our rules say **keep renting** until you have all three in cash (not borrowed):\n" +
      "1) **20% down**\n" +
      "2) **Closing costs**\n" +
      "3) A funded **emergency fund** that stays intact after closing\n\n" +
      "And the resulting housing payment must still fit **≤35% of gross income**. If any piece is missing, renting a bit longer is the lower-stress move — it isn't a failure, it's timing." +
      savedNumbersBlock(stateSummary, "Checklist")
    );
  }

  if (/lower|reduce|cheaper|bring down/i.test(t) && /payment|cost|housing|monthly/i.test(t)) {
    return (
      "The biggest levers on monthly housing cost, roughly in order:\n" +
      "1) **Lower purchase price** — shrinks loan, tax, and insurance together.\n" +
      "2) **More down payment** — directly reduces the loan you finance.\n" +
      "3) **Lower interest rate** — shop lenders; even a fraction of a point helps.\n" +
      "4) **30-year vs 15-year term** — a 30-year lowers the monthly payment (but costs more interest overall; we allow both).\n\n" +
      "Property tax and insurance are mostly set by the home, so price is usually the strongest single lever." +
      savedNumbersBlock(stateSummary, "Checklist")
    );
  }

  if (/refinanc|refi\b/i.test(t)) {
    return (
      "We refinance when the **new rate is at least 1 percentage point lower** than your current rate (e.g. 7% → 6% or better) — and only after checking that closing costs are worth it for how long you'll keep the loan." +
      savedNumbersBlock(stateSummary, "Checklist")
    );
  }

  if (/15|30/i.test(t) && /year|term/i.test(t)) {
    return (
      "We only use **15- or 30-year** mortgages.\n\n" +
      "**15-year:** higher monthly payment, much less total interest, equity builds fast.\n" +
      "**30-year:** lower monthly payment, more total interest.\n\n" +
      "Pick based on cash flow — but don't go outside 15 or 30."
    );
  }

  return null;
}

function explainInvestment(t: string, stateSummary: string): string | null {
  if (/\brisky\b|why.*risk/i.test(t)) {
    return (
      "Risk in this section usually means **skipping safety layers** — investing extra before you've captured your employer match, cleared high-interest debt, or built an emergency fund.\n\n" +
      "The priority order exists to reduce stress and forced selling, not to chase the highest return. Each step protects the ones after it." +
      savedNumbersBlock(stateSummary, "status")
    );
  }

  if (/why.*(order|sequence|this way)/i.test(t) || /sequence/i.test(t)) {
    return (
      "The order goes **safety and guaranteed wins first, then long-term growth**:\n\n" +
      "1) **Employer match** — an instant return you can't beat elsewhere.\n" +
      "2) **Starter emergency fund (~$2,000)** — stops a surprise from becoming debt.\n" +
      "3) **High-interest debt** — a guaranteed cost that usually outruns market gains.\n" +
      "4) **Full emergency fund (3–6 months)** — lets you invest with a steady hand.\n" +
      "5–8) **HSA, Roth IRA, max 401(k), then taxable brokerage** — tax-advantaged growth before regular investing.\n\n" +
      "It's fixed on purpose — earlier steps make the later ones safer." +
      savedNumbersBlock(stateSummary, "status")
    );
  }

  if (/match/i.test(t)) {
    return (
      "The **401(k) employer match is first** because it's the closest thing to free money — an immediate, guaranteed return on every dollar you contribute (often 50–100%).\n\n" +
      "No investment reliably beats that, so we capture the full match before anything else — even before paying down debt."
    );
  }

  if (/debt/i.test(t)) {
    return (
      "Pay down **high-interest debt** (think credit cards) **before investing extra** — but **after** you've grabbed the full 401(k) match and built a ~$2,000 starter emergency fund.\n\n" +
      "The reason: high-interest debt is a **guaranteed** cost that's hard to beat in the market, so clearing it is effectively a risk-free return." +
      savedNumbersBlock(stateSummary, "status")
    );
  }

  return null;
}

/** Deterministic debt-module explanations (specs/debt.yaml). */
export function explainDebt(
  thread: ExplainThreadMsg[]
): string | null {
  return explainDebtQuestion({ thread });
}

function fallbackExplain(
  topic: TopicId,
  userMessage: string,
  stateSummary: string,
  thread: ExplainThreadMsg[]
): string | null {
  const t = userMessage.trim();
  if (topic === "car-loan") return explainCarLoan(t, stateSummary, thread);
  if (topic === "mortgage") return explainMortgage(t, stateSummary);
  return explainInvestment(t, stateSummary);
}

/**
 * Deterministic explanation of a rule question. Outcomes come from the rule
 * engine; this only phrases the "why" and "what next" from fixed copy.
 */
export function explainRuleQuestion(params: {
  topic: TopicId;
  thread: ExplainThreadMsg[];
  state: unknown;
}): string | null {
  const { topic, thread, state } = params;
  const userMessage = [...thread].reverse().find((m) => m.role === "user")?.content ?? "";
  if (!userMessage.trim()) return null;

  const stateSummary = summarizeState(topic, state);
  return fallbackExplain(topic, userMessage, stateSummary, thread);
}
