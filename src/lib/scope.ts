"use server";

export async function isFinanceQuestion(question: string): Promise<boolean> {
  const financeKeywords = [
    "invest","debt","savings","retirement","401k","roth",
    "hsa","emergency","portfolio","index fund","bonus","money"
  ];

  const q = question.toLowerCase();
  return financeKeywords.some(k => q.includes(k));
}
