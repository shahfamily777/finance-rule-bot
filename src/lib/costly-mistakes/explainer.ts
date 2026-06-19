/**
 * Educational explainer for the "Avoid Costly Mistakes" module.
 * Calm, neutral, never accusatory. Explains costs, tradeoffs, incentives,
 * and alternatives. Behavior spec: specs/costly-mistakes.yaml
 */
import { costlyMistakesSpec } from "@/lib/specs";
import type { CostlyMistakeTopic } from "@/lib/specs";
import { getCostlyMistakeTopic } from "@/lib/costly-mistakes";

export type ExplainThreadMsg = { role: "user" | "assistant"; content: string };

const spec = costlyMistakesSpec;

/** Intent-matched, spec-driven educational answer. */
export function fallbackCostlyMistakesAnswer(
  topic: CostlyMistakeTopic,
  userMessage: string
): string {
  const t = userMessage.toLowerCase();
  const bullets = (items: string[]) => items.map((i) => `• ${i}`).join("\n");

  if (/\b(cost|fee|expensive|charge|price|how much)\b/.test(t)) {
    return `Here are the main costs and tradeoffs of **${topic.name}**:\n\n${bullets(
      topic.costs
    )}\n\n${spec.disclaimer}`;
  }
  if (/\b(alternative|instead|cheaper|other option|better)\b/.test(t)) {
    return `Lower-cost alternatives worth comparing for **${topic.name}**:\n\n${bullets(
      topic.alternatives
    )}\n\n${spec.disclaimer}`;
  }
  if (/\b(who|benefit|good for|right for|should i)\b/.test(t)) {
    return `Who genuinely benefits from **${topic.name}**:\n\n${bullets(
      topic.who_benefits
    )}\n\n${spec.disclaimer}`;
  }
  if (/\b(why|reason|appeal|sold|pitch)\b/.test(t)) {
    return `Why people buy **${topic.name}**:\n\n${bullets(
      topic.why_people_buy
    )}\n\n${spec.disclaimer}`;
  }
  if (/\b(ask|question|before|due diligence|check)\b/.test(t)) {
    return `Good questions to ask before committing to **${topic.name}**:\n\n${bullets(
      topic.questions_to_ask
    )}\n\n${spec.disclaimer}`;
  }
  if (/\b(what is|what are|explain|how does|tell me about)\b/.test(t)) {
    return `**${topic.name}** — ${topic.what_is_it.trim()}\n\n${spec.disclaimer}`;
  }

  return `Here's a quick orientation on **${topic.name}**:\n\n${topic.what_is_it.trim()}\n\nMain tradeoffs:\n${bullets(
    topic.costs.slice(0, 3)
  )}\n\nAsk about the costs, who benefits, alternatives, or questions to ask. ${spec.disclaimer}`;
}

/**
 * Deterministic educational answer for a costly-mistakes topic.
 * Pulls from the structured spec (costs, alternatives, who benefits, etc.).
 * No external model is called.
 */
export function explainCostlyMistake(params: {
  topicId: string;
  thread: ExplainThreadMsg[];
}): string | null {
  const { topicId, thread } = params;
  const topic = getCostlyMistakeTopic(topicId);
  if (!topic) return null;

  const userMessage =
    [...thread].reverse().find((m) => m.role === "user")?.content ?? "";
  if (!userMessage.trim()) return null;

  return fallbackCostlyMistakesAnswer(topic, userMessage);
}
