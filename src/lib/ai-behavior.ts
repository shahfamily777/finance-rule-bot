/**
 * AI behavior for Finance Rules — sourced from specs/ai-behavior.yaml (compiled).
 * Core principle: Rules decide. AI explains.
 */

import { aiBehaviorSpec, carSpec, investmentSpec, mortgageSpec } from "@/lib/specs";
import type { TopicId } from "@/lib/section-qa";

export const AI_DISCLAIMER = aiBehaviorSpec.disclaimer;
export const AI_CORE_PRINCIPLE = aiBehaviorSpec.core_principle;

const SECTION_LABEL: Record<TopicId, string> = {
  "car-loan": "Car loan",
  mortgage: "Mortgage",
  investment: "Investment",
};

function investmentPriorityFromSpecs(): string {
  return investmentSpec.priority_order
    .map((s) => `${s.step}) ${s.summary}`)
    .join("\n");
}

function topicRulesBlock(topic: TopicId): string {
  if (topic === "car-loan") {
    const r = carSpec.rules;
    const phil = aiBehaviorSpec.car_loan.philosophy.map((p) => `- ${p}`).join("\n");
    return `CAR LOAN RULES (fixed — never contradict):
${carSpec.rules_summary.trim()}

Hard limits: ≥${r.min_down_payment_pct}% down · max ${r.max_loan_term_months} months · transport ≤${r.max_transport_pct_of_gross}% of gross income.

Philosophy when explaining:
${phil}

If payment only "works" at 60–72 months: cheaper car, more down, better rate, or wait — NOT a longer loan.`;
  }
  if (topic === "mortgage") {
    const phil = aiBehaviorSpec.mortgage.philosophy.map((p) => `- ${p}`).join("\n");
    return `MORTGAGE RULES (fixed — never contradict):
${mortgageSpec.rules_summary.trim()}

Philosophy when explaining:
${phil}`;
  }
  const phil = aiBehaviorSpec.investment.philosophy.map((p) => `- ${p}`).join("\n");
  return `INVESTMENT PRIORITY (fixed order from specs — never reorder or skip steps):
${investmentPriorityFromSpecs()}

${aiBehaviorSpec.investment.note}

Philosophy when explaining:
${phil}`;
}

/** System prompt for OpenAI rule explainer (post-assessment guided Q&A). */
export function buildRuleExplainerSystemPrompt(
  topic: TopicId,
  stateSummary: string
): string {
  const ai = aiBehaviorSpec;
  return `You are the explanation layer for "Finance Rules" — a rule-based financial guidance app.

CORE PRINCIPLE: ${ai.core_principle}
The rule engine already decided the outcome. You explain calmly — you do NOT change the result.

YOUR ROLE:
${ai.role.should.map((s) => `✓ ${s}`).join("\n")}

YOU MUST NOT:
${ai.role.should_not.map((s) => `✗ ${s}`).join("\n")}

TONE: ${ai.tone.qualities.join(", ")}.
Avoid: ${ai.tone.avoid.join(", ")}.

PRODUCT PHILOSOPHY:
${ai.philosophy.map((p) => `- ${p}`).join("\n")}

OUTPUT STYLE:
${ai.output_style.map((s) => `- ${s}`).join("\n")}

WHEN EXPLAINING ASSESSMENTS:
Focus on: ${ai.assessment_explanation.focus_on.join(", ")}.
${ai.assessment_explanation.approach.map((s) => `- ${s}`).join("\n")}

FOLLOW-UP QUESTIONS:
Stay in the **${SECTION_LABEL[topic]}** section. Guided examples: ${ai.follow_up.examples.join("; ")}.

IF OFF-TOPIC OR UNRELATED:
${ai.off_topic.behavior.map((s) => `- ${s}`).join("\n")}

NEVER:
${ai.restrictions.never.map((s) => `- ${s}`).join("\n")}

---
${topicRulesBlock(topic)}
---

User's saved data:
${stateSummary}

Goal: ${ai.product_goal}`;
}

/** Polite redirect when chat drifts off-topic (deterministic path). */
export function offTopicRedirectMessage(topic: TopicId): string {
  return aiBehaviorSpec.off_topic.redirect_template.replace(
    "{section}",
    SECTION_LABEL[topic]
  );
}

/** Short reminder for assessment UI copy. */
export function assessmentAiNote(): string {
  return `${AI_CORE_PRINCIPLE} ${AI_DISCLAIMER}.`;
}
