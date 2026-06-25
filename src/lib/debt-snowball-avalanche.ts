import { debtSpec } from "@/lib/specs/bundle";

export type PayoffPreference = "motivation" | "minimize_interest";

export type SnowballAvalancheRecommendation = {
  method: "snowball" | "avalanche";
  methodName: string;
  headline: string;
  reasoning: string;
};

const spec = debtSpec.snowball_avalanche;

export function getSnowballAvalancheContent() {
  return {
    snowball: spec.snowball,
    avalanche: spec.avalanche,
    comparison: spec.comparison,
  };
}

export function recommendPayoffMethod(
  preference: PayoffPreference
): SnowballAvalancheRecommendation {
  if (preference === "motivation") {
    return {
      method: "snowball",
      methodName: spec.snowball.name,
      headline: "Debt snowball fits your preference",
      reasoning:
        "You value motivation and quick wins. The snowball method pays the smallest balance first, " +
        "so you see accounts close sooner. That momentum can help you stay consistent — even if you " +
        "pay slightly more interest than the avalanche method.",
    };
  }

  return {
    method: "avalanche",
    methodName: spec.avalanche.name,
    headline: "Debt avalanche fits your preference",
    reasoning:
      "You want to minimize total interest. The avalanche method targets the highest interest rate " +
      "first, which usually saves the most money over time. Progress may feel slower if that debt " +
      "is large, but the math works in your favor.",
  };
}
