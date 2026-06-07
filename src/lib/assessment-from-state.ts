import { buildCarLoanStructuredAssessment } from "@/lib/assessment-car";
import type { CarLoanConversationState } from "@/lib/car-loan-flow";
import { buildInvestmentStructuredAssessment } from "@/lib/assessment-investment";
import type { ConversationState } from "@/lib/conversation";
import { buildMortgageStructuredAssessment } from "@/lib/assessment-mortgage";
import type { StructuredAssessment } from "@/lib/assessment-types";
import type { MortgageConversationState } from "@/lib/mortgage-flow";
import type { SectionId } from "@/lib/section-theme";

export function isIntakeComplete(state: unknown): boolean {
  return Boolean(
    state &&
      typeof state === "object" &&
      "intakeComplete" in state &&
      (state as { intakeComplete?: boolean }).intakeComplete
  );
}

export function assessmentFromChatState(
  section: SectionId,
  state: unknown
): StructuredAssessment | null {
  if (!isIntakeComplete(state) || !state || typeof state !== "object") return null;
  if (section === "car-loan") {
    return buildCarLoanStructuredAssessment(state as CarLoanConversationState);
  }
  if (section === "mortgage") {
    return buildMortgageStructuredAssessment(state as MortgageConversationState);
  }
  return buildInvestmentStructuredAssessment(state as ConversationState);
}
