/**
 * Deterministic educational explainer for the Big Purchase Decisions module.
 * Behavior spec: specs/big-purchase.yaml
 */
import { bigPurchaseSpec } from "@/lib/specs/bundle";

export type ExplainThreadMsg = { role: "user" | "assistant"; content: string };

const spec = bigPurchaseSpec;
const rules = spec.rules;

function interpolateCopy(text: string): string {
  return text
    .replace(/\{comfortable_max_payment_pct\}/g, String(rules.comfortable_max_payment_pct))
    .replace(/\{comfortable_max_dti_pct\}/g, String(rules.comfortable_max_dti_pct))
    .replace(/\{min_ef_months_comfortable\}/g, String(rules.min_ef_months_comfortable));
}

export function explainBigPurchaseQuestion(params: {
  thread: ExplainThreadMsg[];
}): string | null {
  const userMessage =
    [...params.thread].reverse().find((m) => m.role === "user")?.content ?? "";
  if (!userMessage.trim()) return null;

  const t = userMessage.toLowerCase();

  if (/\b(comfortable|manageable)\b/.test(t)) {
    return (
      interpolateCopy(spec.direct_answers.what_is_comfortable) +
      `\n\n${spec.messages.disclaimer}`
    );
  }

  if (/\bstretch\b/.test(t)) {
    return spec.direct_answers.what_is_stretch + `\n\n${spec.messages.disclaimer}`;
  }

  if (/\b(risky|risk)\b/.test(t)) {
    return spec.direct_answers.what_is_risky + `\n\n${spec.messages.disclaimer}`;
  }

  if (/\b(dti|debt.?to.?income|debt burden)\b/.test(t)) {
    return (
      interpolateCopy(spec.direct_answers.dti_rule) + `\n\n${spec.messages.disclaimer}`
    );
  }

  if (/\b(opportunity cost|tradeoff|giving up)\b/.test(t)) {
    return (
      "**Opportunity cost** — every major purchase redirects money that could go elsewhere:\n\n" +
      Object.values(spec.opportunity_cost)
        .map((v) => `• ${v}`)
        .join("\n") +
      `\n\nThese are objective tradeoffs — not recommendations about what you should do.\n\n${spec.messages.disclaimer}`
    );
  }

  if (/\b(emergency fund|reserves)\b/.test(t)) {
    return (
      `A starter emergency fund target is about $${spec.constants.starter_emergency_fund_target.toLocaleString()}. ` +
      `After a purchase, aim for at least ${rules.min_ef_months_comfortable} months of essential spending in reserves.\n\n` +
      spec.messages.disclaimer
    );
  }

  if (/\b(what|how|explain|rules|threshold)\b/.test(t)) {
    return (
      "**Big purchase rules** in this app:\n\n" +
      `• Payment ≤ ${rules.comfortable_max_payment_pct}% of income → comfortable\n` +
      `• Total debt ≤ ${rules.comfortable_max_dti_pct}% of income → comfortable\n` +
      `• Emergency fund ≥ ${rules.min_ef_months_comfortable} months of essentials → comfortable\n` +
      `• Down payment ≥ ${rules.min_down_payment_pct_comfortable}% → strong\n\n` +
      "Scores above these thresholds move the assessment toward Stretch or Risky.\n\n" +
      spec.messages.disclaimer
    );
  }

  return null;
}
