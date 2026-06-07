import type { SectionId } from "@/lib/section-theme";

export type GuidedPrompt = { id: string; label: string; message: string };

export const GUIDED_PROMPTS: Record<SectionId, GuidedPrompt[]> = {
  "car-loan": [
    {
      id: "risky",
      label: "Why is this risky?",
      message: "Why might my car loan setup be risky under your rules?",
    },
    {
      id: "term-compare",
      label: "48 vs 72 months",
      message: "Compare a 48-month loan vs 72 months under your car loan rules.",
    },
    {
      id: "safer-payment",
      label: "What payment is safer?",
      message: "What monthly payment would be safer for my income and transportation cap?",
    },
    {
      id: "income-growth",
      label: "If my income grows",
      message: "What changes if my gross monthly income increases later?",
    },
  ],
  mortgage: [
    {
      id: "risky",
      label: "Why is this risky?",
      message: "Why might this mortgage situation be risky under your housing rules?",
    },
    {
      id: "affordability",
      label: "Max home price",
      message: "How did you calculate the max affordable home price at 35% of income?",
    },
    {
      id: "rent-vs-buy",
      label: "Rent vs buy",
      message: "When do your rules say to keep renting instead of buying?",
    },
    {
      id: "lower-payment",
      label: "Lower monthly cost",
      message: "What would lower my total monthly housing cost the most?",
    },
  ],
  investment: [
    {
      id: "why-order",
      label: "Why this order?",
      message: "Why does the investment priority order go in this sequence?",
    },
    {
      id: "match-first",
      label: "401(k) match first",
      message: "Why is the 401(k) employer match usually first?",
    },
    {
      id: "debt-vs-invest",
      label: "Debt vs investing",
      message: "When should I pay debt before investing extra money?",
    },
    {
      id: "full-plan",
      label: "Show my plan again",
      message: "Give me the full investment priority plan again.",
    },
  ],
};
