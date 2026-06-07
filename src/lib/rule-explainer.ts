/**
 * Calm, human explanations of fixed rules — used when a canned line would feel robotic.
 * Rules still decide outcomes; the model explains why and what to do next.
 * Behavior spec: specs/ai-behavior.yaml
 */

import { buildCarLoanStructuredAssessment } from "@/lib/assessment-car";
import type { CarLoanConversationState } from "@/lib/car-loan-flow";
import { buildMortgageStructuredAssessment } from "@/lib/assessment-mortgage";
import type { MortgageConversationState } from "@/lib/mortgage-flow";
import { buildInvestmentStructuredAssessment } from "@/lib/assessment-investment";
import type { ConversationState } from "@/lib/conversation";
import { buildRuleExplainerSystemPrompt } from "@/lib/ai-behavior";
import {
  isUserAskingQuestion,
  type TopicId,
} from "@/lib/section-qa";

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

function fallbackExplain(
  topic: TopicId,
  userMessage: string,
  stateSummary: string,
  thread: ExplainThreadMsg[]
): string | null {
  const t = userMessage.trim();

  if (/\bwhy\s+is\s+this\s+risky\b/i.test(t)) {
    if (topic === "car-loan") {
      return (
        "Risk here usually means **monthly pressure** — payment, insurance, and fuel eating too much of gross income, or a loan term that outlasts the car's value.\n\n" +
        "Our rules cap stress at **10% transportation** of income and **48 months** max. Longer loans feel easier monthly but leave you paying more total and often upside-down.\n\n" +
        (stateSummary.includes("Checklist")
          ? `Your assessment:\n${stateSummary.split("\n").slice(-2).join("\n")}`
          : "Update your numbers if anything changed.")
      );
    }
    if (topic === "mortgage") {
      return (
        "Risk here is mostly **monthly rigidity** — housing costs that leave little room if income dips, plus buying without cash reserves for down, closing, and emergencies.\n\n" +
        "We focus on **≤35% of gross income** for housing and full cash readiness before buying — not stretching to the approval maximum."
      );
    }
    return (
      "Risk in this section usually means skipping safety layers (emergency fund, debt payoff) before investing — or investing before your basics are in place.\n\n" +
      "The priority order exists to reduce stress, not to optimize returns."
    );
  }

  if (/\bcompare\b/i.test(t) && /\b(48|72|60)\b/i.test(t) && topic === "car-loan") {
    return (
      "**48 months** is our maximum — acceptable and usually less total interest than longer terms.\n\n" +
      "**60 or 72 months** lower the monthly payment but increase total cost and upside-down risk. This app **does not** use or recommend them.\n\n" +
      "If 48 months feels tight, the fix is price, down payment, or rate — not a longer term."
    );
  }

  if (topic !== "car-loan") return null;

  if (isConversationalNumericReply(t, thread)) {
    const raw = t.replace(/,/g, "").replace(/^\$/, "");
    const n = Number(raw.replace(/k$/i, "000"));
    const amt = Number.isFinite(n) ? n : null;
    const lastAssistant = [...thread].reverse().find((m) => m.role === "assistant");
    if (amt !== null && lastAssistant && /down|putting/i.test(lastAssistant.content)) {
      return (
        `Got it — **$${amt.toLocaleString()}** down.\n\n` +
        "That's separate from the **48-month term cap** (48 months is the longest loan we allow, not a down-payment program).\n\n" +
        "Next, compare that down payment to **20% of the car price**. If the **monthly payment at 48 months or less** still busts the **10% transportation** rule, the usual fixes are a lower purchase price, saving more for down, a better rate, or waiting — not a 60- or 72-month loan.\n\n" +
        (stateSummary.includes("Vehicle")
          ? `Your saved checklist:\n${stateSummary}`
          : "Use **Update your numbers** if you want to plug this into your full checklist.")
      );
    }
  }

  if (
    /\bwhy\b/i.test(t) &&
    /\b(48|four year|longer|beyond|more than|maximum)\b/i.test(t)
  ) {
    return (
      "We keep car loans at **48 months or less** because the car loses value much faster than the loan balance drops on long terms — that's how people end up upside-down and stuck.\n\n" +
      "That rule isn't negotiable in this app, but **shorter** than 48 is fine. If 48 months still feels tight, it usually means the car, down payment, or rate needs adjusting — not a 60- or 72-month loan.\n\n" +
      (stateSummary.includes("Vehicle")
        ? `With your saved numbers:\n${stateSummary}\n\n`
        : "") +
      "Practical levers: more down, a lower purchase price, a lower APR, or waiting until cash flow is clearer."
    );
  }

  if (
    /\b(not enough|don't have enough|can't).{0,40}down\b/i.test(t) &&
    /\b48\b/i.test(t)
  ) {
    return (
      "It sounds like two ideas got tangled: **48 months** is the **longest loan term** we allow — it isn't a down-payment amount or a special program.\n\n" +
      "If the **payment** at 48 months feels too high, that's separate from the **20% down** rule. You can:\n" +
      "• Save toward more down (reduces the loan and payment)\n" +
      "• Choose a less expensive car\n" +
      "• Shop for a better APR\n" +
      "• Wait until the numbers fit — we don't extend past 48 months to make the payment work\n\n" +
      (stateSummary.includes("Down payment")
        ? `From what you entered before:\n${stateSummary}`
        : "If you share or update your price, down payment, and income, we can rerun the checklist.")
    );
  }

  if (/\bwhat should i do\b/i.test(t) && /down|48|payment|afford/i.test(t)) {
    return (
      "A calm order of operations:\n" +
      "1) Confirm the **price** and whether **20% down** is realistic (or how far you are from it).\n" +
      "2) Run the payment at **48 months or less** with your real APR — if it's over **10% of gross income** with insurance and fuel, the car is probably too expensive for now.\n" +
      "3) Adjust price, down, or timing — not the term past 48 months.\n\n" +
      "Use **Update your numbers** if you want to change what's saved and see an updated assessment."
    );
  }

  return null;
}

export async function explainRuleQuestion(params: {
  topic: TopicId;
  thread: ExplainThreadMsg[];
  state: unknown;
  apiKey?: string;
}): Promise<string | null> {
  const { topic, thread, state, apiKey } = params;
  const userMessage = [...thread].reverse().find((m) => m.role === "user")?.content ?? "";
  if (!userMessage.trim()) return null;

  const stateSummary = summarizeState(topic, state);
  const fallback = fallbackExplain(topic, userMessage, stateSummary, thread);
  if (!apiKey) return fallback;

  const recent = thread.slice(-8).map((m) => `${m.role}: ${m.content}`).join("\n");
  const system = buildRuleExplainerSystemPrompt(topic, stateSummary);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.5,
        max_tokens: 450,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Recent conversation:\n${recent}\n\nReply to the user's latest message. Rules decide — you explain. Stay in ${topic} topic.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[rule-explainer] OpenAI error", res.status, await res.text());
      return fallback;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    return content && content.length > 0 ? content : fallback;
  } catch (e) {
    console.error("[rule-explainer]", e);
    return fallback;
  }
}
