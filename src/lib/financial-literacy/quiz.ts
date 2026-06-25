import type { FinancialLiteracyQuiz } from "@/lib/specs/types";

export type QuizResult = {
  correct: boolean;
  selectedIndex: number;
  correctIndex: number;
  explanation: string;
};

export function evaluateQuizAnswer(
  quiz: FinancialLiteracyQuiz,
  selectedIndex: number
): QuizResult {
  return {
    correct: selectedIndex === quiz.correctIndex,
    selectedIndex,
    correctIndex: quiz.correctIndex,
    explanation: quiz.explanation.trim(),
  };
}

/** Future value of monthly contributions with compound growth (monthly compounding). */
export function projectMonthlyContributions(
  monthly: number,
  years: number,
  annualRatePct: number
): number {
  if (monthly <= 0 || years <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (r === 0) return monthly * n;
  return monthly * ((Math.pow(1 + r, n) - 1) / r);
}
