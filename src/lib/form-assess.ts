import { buildCarLoanStructuredAssessment } from "@/lib/assessment-car";
import { buildInvestmentStructuredAssessment } from "@/lib/assessment-investment";
import { buildMortgageStructuredAssessment } from "@/lib/assessment-mortgage";
import type { StructuredAssessment } from "@/lib/assessment-types";
import type { CarLoanFormValues, InvestmentFormValues, MortgageFormValues } from "@/lib/form-types";
import {
  assertCarLoanFormSanity,
  assertInvestmentFormSanity,
  assertMortgageFormSanity,
} from "@/lib/form-sanity";
import {
  assessCarLoanState,
  carLoanStateFromForm,
  type CarLoanConversationState,
} from "@/lib/car-loan-flow";
import {
  assessMortgageState,
  mortgageStateFromForm,
  type MortgageConversationState,
} from "@/lib/mortgage-flow";
import {
  assessInvestmentState,
  investmentStateFromForm,
  type ConversationState,
} from "@/lib/conversation";

export type FormAssessResult = {
  answer: string;
  assessment: StructuredAssessment;
  state: CarLoanConversationState | MortgageConversationState | ConversationState;
};

export type FormAssessOptions = { sanityAcknowledged?: boolean };

export function assessCarLoanForm(
  form: CarLoanFormValues,
  options?: FormAssessOptions
): FormAssessResult {
  if (!options?.sanityAcknowledged) {
    assertCarLoanFormSanity(form);
  }
  const state = carLoanStateFromForm(form);
  const result = assessCarLoanState(state);
  return {
    answer: result.answer,
    assessment: buildCarLoanStructuredAssessment(state),
    state: { ...result.state, intakeComplete: true },
  };
}

export function assessMortgageForm(
  form: MortgageFormValues,
  options?: FormAssessOptions
): FormAssessResult {
  if (!options?.sanityAcknowledged) {
    assertMortgageFormSanity(form);
  }
  const state = mortgageStateFromForm(form);
  const result = assessMortgageState(state);
  return {
    answer: result.answer,
    assessment: buildMortgageStructuredAssessment(state),
    state: { ...result.state, intakeComplete: true },
  };
}

export function assessInvestmentForm(
  form: InvestmentFormValues,
  options?: FormAssessOptions
): FormAssessResult {
  if (!options?.sanityAcknowledged) {
    assertInvestmentFormSanity(form);
  }
  const state = investmentStateFromForm(form);
  const result = assessInvestmentState(state);
  return {
    answer: result.answer,
    assessment: buildInvestmentStructuredAssessment(state),
    state: { ...result.state, intakeComplete: true },
  };
}
