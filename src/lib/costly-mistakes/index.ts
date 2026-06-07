import { costlyMistakesSpec } from "@/lib/specs";
import type { CostlyMistakeTopic } from "@/lib/specs";

export const COSTLY_MISTAKES = costlyMistakesSpec;

export type CostlyMistakeAnswers = Record<string, string>;

export function getCostlyMistakeTopics(): readonly CostlyMistakeTopic[] {
  return costlyMistakesSpec.topics;
}

export function getCostlyMistakeTopic(id: string): CostlyMistakeTopic | null {
  return costlyMistakesSpec.topics.find((t) => t.id === id) ?? null;
}

export function isCostlyMistakeTopicId(id: unknown): id is string {
  return (
    typeof id === "string" &&
    costlyMistakesSpec.topics.some((t) => t.id === id)
  );
}

/**
 * Calm, educational reflections personalized from the standardized question ids
 * (goal / pressure / understands / compared). Never alarmist, never a verdict —
 * just things worth thinking about before committing.
 */
export function buildReflections(
  topic: CostlyMistakeTopic,
  answers: CostlyMistakeAnswers
): string[] {
  const out: string[] = [];
  const isInsurance = topic.category === "insurance-investment";
  const isPurchase = topic.category === "big-purchase";
  const isAdvisor = topic.category === "advisor";

  if (answers.pressure === "yes") {
    out.push(
      "You mentioned feeling some pressure to decide soon. Sales urgency is a reason to slow down, not speed up — a sound decision still looks sound after a week of thinking."
    );
  }

  if (answers.understands === "no") {
    if (isInsurance) {
      out.push(
        "Since the full fee and cost structure isn't fully clear yet, that's the first thing to get in writing — year-by-year costs and guaranteed (not illustrated) values — before committing."
      );
    } else if (isAdvisor) {
      out.push(
        "Since your all-in annual cost isn't clear yet, ask for it in dollars — advisor fee plus fund fees combined. A 1% fee sounds small but compounds heavily over decades."
      );
    } else {
      out.push(
        "Since the full ongoing cost isn't totaled yet, add up every recurring expense before deciding — the sticker price is rarely the real cost."
      );
    }
  }

  if (answers.compared === "no") {
    const alt = topic.alternatives[0];
    out.push(
      alt
        ? `It's worth comparing at least one lower-cost alternative first — for example: ${lowercaseFirst(alt)}.`
        : "It's worth comparing at least one lower-cost alternative before deciding."
    );
  }

  if (isInsurance && answers.goal === "investing") {
    out.push(
      "If the main goal is growth, separating insurance from investing is usually cheaper and clearer than combining them in one product."
    );
  }
  if (isInsurance && answers.goal === "protection") {
    out.push(
      "If the main goal is protecting your family, term life typically covers the same need at a fraction of the cost."
    );
  }
  if (isPurchase && (answers.goal === "status" || answers.goal === "deal")) {
    out.push(
      "When status or a sense of a \u201cgood deal\u201d is part of the appeal, it helps to re-check the decision against your actual needs and monthly budget."
    );
  }
  if (isPurchase && answers.goal === "future") {
    out.push(
      "Buying for a \u201csomeday\u201d need means paying for it every month until then. Consider whether buying for how you live now — and adjusting later — keeps you more flexible."
    );
  }
  if (isAdvisor && answers.goal === "investing") {
    out.push(
      "If the main need is investment management, a low-cost index or target-date fund — or a flat-fee advisor — can deliver most of the value without an ongoing percentage fee."
    );
  }

  if (out.length === 0) {
    out.push(
      "You've thought through the main signals here. Use the questions below to confirm the details in writing before you commit."
    );
  }

  return out;
}

/** A calm, non-judgmental one-line headline for the guidance screen. */
export function buildHeadline(
  topic: CostlyMistakeTopic,
  answers: CostlyMistakeAnswers
): string {
  const caution =
    answers.pressure === "yes" ||
    answers.understands === "no" ||
    answers.compared === "no";
  if (caution) {
    return `A few things are worth understanding before committing to ${topic.name.toLowerCase()}.`;
  }
  return `Here's a clear, balanced look at ${topic.name.toLowerCase()}.`;
}

function lowercaseFirst(s: string): string {
  return s.length ? s[0].toLowerCase() + s.slice(1) : s;
}

export type CostlyMistakePrompt = { id: string; label: string; message: string };

/** Suggested follow-up chips for the chat phase. */
export function costlyMistakePrompts(
  topic: CostlyMistakeTopic
): CostlyMistakePrompt[] {
  return [
    {
      id: "costs",
      label: "What are the real costs?",
      message: `What are the real costs and tradeoffs of ${topic.name}?`,
    },
    {
      id: "alternatives",
      label: "What are the alternatives?",
      message: `What are lower-cost alternatives to ${topic.name}?`,
    },
    {
      id: "who",
      label: "Who is it right for?",
      message: `Who genuinely benefits from ${topic.name}?`,
    },
    {
      id: "ask",
      label: "What should I ask?",
      message: `What questions should I ask before committing to ${topic.name}?`,
    },
  ];
}
