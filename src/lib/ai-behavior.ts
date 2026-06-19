/**
 * Behavior copy for Finance Rules — sourced from specs/ai-behavior.yaml (compiled).
 * Core principle: Rules decide. Explanations stay deterministic (no model calls).
 */

import { aiBehaviorSpec } from "@/lib/specs";
import type { TopicId } from "@/lib/section-qa";

export const AI_DISCLAIMER = aiBehaviorSpec.disclaimer;
export const AI_CORE_PRINCIPLE = aiBehaviorSpec.core_principle;

const SECTION_LABEL: Record<TopicId, string> = {
  "car-loan": "Car loan",
  mortgage: "Mortgage",
  investment: "Investment",
};

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
