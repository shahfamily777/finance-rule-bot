import { financialLiteracySpec } from "@/lib/specs/bundle";
import type { FinancialLiteracyTopic } from "@/lib/specs/types";

export const FINANCIAL_LITERACY = financialLiteracySpec;

export function getFinancialLiteracyTopics(): readonly FinancialLiteracyTopic[] {
  return financialLiteracySpec.topics;
}

export function getFinancialLiteracyTopic(id: string): FinancialLiteracyTopic | null {
  return financialLiteracySpec.topics.find((t) => t.id === id) ?? null;
}

export { getCompletedTopics, isTopicCompleted, markTopicCompleted, getCompletionCount } from "./progress";
export { evaluateQuizAnswer, projectMonthlyContributions } from "./quiz";
export type { QuizResult } from "./quiz";
