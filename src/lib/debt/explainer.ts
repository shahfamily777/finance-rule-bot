/**
 * Deterministic educational explainer for the Debt module.
 * Behavior spec: specs/debt.yaml
 */
import { debtSpec } from "@/lib/specs/bundle";

export type ExplainThreadMsg = { role: "user" | "assistant"; content: string };

const spec = debtSpec;

function interpolateDebtCopy(text: string): string {
  return text
    .replace(/\{high_interest_debt_pct\}/g, String(spec.rules.high_interest_debt_pct))
    .replace(/\{debt_vs_invest_focus_debt_pct\}/g, String(spec.rules.debt_vs_invest_focus_debt_pct))
    .replace(/\{debt_vs_invest_mixed_low_pct\}/g, String(spec.rules.debt_vs_invest_mixed_low_pct))
    .replace(/\{debt_vs_invest_mixed_high_pct\}/g, String(spec.rules.debt_vs_invest_mixed_high_pct))
    .replace(
      /\$\{starter_emergency_fund_target\}/g,
      String(spec.constants.starter_emergency_fund_target)
    );
}

export function explainDebtQuestion(params: {
  thread: ExplainThreadMsg[];
  subSection?: string;
}): string | null {
  const userMessage =
    [...params.thread].reverse().find((m) => m.role === "user")?.content ?? "";
  if (!userMessage.trim()) return null;

  const t = userMessage.toLowerCase();

  if (/\b(snowball|smallest balance)\b/.test(t)) {
    const s = spec.snowball_avalanche.snowball;
    return (
      `**${s.name}** — ${s.description}\n\n` +
      `Benefits:\n${s.benefits.map((b) => `• ${b}`).join("\n")}\n\n` +
      `Drawbacks:\n${s.drawbacks.map((d) => `• ${d}`).join("\n")}\n\n` +
      spec.direct_answers.snowball_rule +
      `\n\n${spec.messages.disclaimer}`
    );
  }

  if (/\b(avalanche|highest interest|highest rate)\b/.test(t)) {
    const a = spec.snowball_avalanche.avalanche;
    return (
      `**${a.name}** — ${a.description}\n\n` +
      `Benefits:\n${a.benefits.map((b) => `• ${b}`).join("\n")}\n\n` +
      `Drawbacks:\n${a.drawbacks.map((d) => `• ${d}`).join("\n")}\n\n` +
      spec.direct_answers.avalanche_rule +
      `\n\n${spec.messages.disclaimer}`
    );
  }

  if (/\b(snowball|avalanche).*(which|better|choose|pick|vs|versus)/.test(t) ||
      /\b(which|better).*(snowball|avalanche)/.test(t)) {
    return (
      "**Snowball vs avalanche** — both work if you stay consistent.\n\n" +
      "• **Snowball** — smallest balance first. Best if you want quick wins and motivation.\n" +
      "• **Avalanche** — highest interest rate first. Best if you want to minimize total interest.\n\n" +
      "Use the Snowball vs Avalanche section to pick based on your preference.\n\n" +
      spec.messages.disclaimer
    );
  }

  if (/\b(debt|pay off|payoff).*(invest|401|roth|stock|market)/.test(t) ||
      /\b(invest|401|roth).*(debt|pay off)/.test(t)) {
    const r = spec.debt_vs_investing;
    return (
      "**Debt vs investing** — our rules use the interest rate as a guide:\n\n" +
      `• **${r.focus_debt.headline}** — rate ≥ ${spec.rules.debt_vs_invest_focus_debt_pct}%\n` +
      `• **${r.mixed.headline}** — rate between ${spec.rules.debt_vs_invest_mixed_low_pct}% and ${spec.rules.debt_vs_invest_mixed_high_pct}%\n` +
      `• **${r.consider_investing.headline}** — rate below ${spec.rules.debt_vs_invest_mixed_low_pct}%\n\n` +
      "Capturing a 401(k) employer match and having a starter emergency fund usually come first.\n\n" +
      spec.messages.disclaimer
    );
  }

  if (/\b(high.?interest|credit card|apr|rate)\b/.test(t)) {
    return (
      interpolateDebtCopy(spec.direct_answers.high_interest_first) +
      "\n\n" +
      interpolateDebtCopy(spec.direct_answers.emergency_before_aggressive) +
      `\n\n${spec.messages.disclaimer}`
    );
  }

  if (/\b(emergency fund|starter fund|cushion)\b/.test(t)) {
    return (
      `A starter emergency fund of about $${spec.constants.starter_emergency_fund_target.toLocaleString()} ` +
      "helps cover small surprises without adding new debt. Build this while making minimum payments on all debts.\n\n" +
      spec.messages.disclaimer
    );
  }

  if (/\b(payoff|pay off|debt.?free|how long|months|calculator)\b/.test(t)) {
    return (
      "The **Debt-Free Date** calculator estimates payoff for a single debt using your balance, " +
      "interest rate, and monthly payment. It uses standard amortization math — actual timelines may vary " +
      "if rates or payments change.\n\n" +
      spec.messages.disclaimer
    );
  }

  if (/\b(what|explain|how|rules|help)\b/.test(t)) {
    return (
      "The **Debt** module has four sections:\n\n" +
      "1. **Debt Assessment** — review balances, rates, cash flow, and emergency fund\n" +
      "2. **Snowball vs Avalanche** — compare payoff methods\n" +
      "3. **Debt vs Investing** — decide where extra cash should go\n" +
      "4. **Debt-Free Date** — estimate when a debt could be paid off\n\n" +
      spec.messages.disclaimer
    );
  }

  return (
    "Ask about snowball vs avalanche, high-interest debt, debt vs investing, emergency funds, or payoff timelines.\n\n" +
    spec.messages.disclaimer
  );
}
