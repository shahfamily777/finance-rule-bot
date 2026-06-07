"use client";



import { FormThemeProvider } from "@/components/FormThemeContext";

import { CarLoanGuidedFlow } from "@/components/guided/CarLoanGuidedFlow";

import { InvestmentGuidedFlow } from "@/components/guided/InvestmentGuidedFlow";

import { MortgageGuidedFlow } from "@/components/guided/MortgageGuidedFlow";

import type {

  CarLoanFormValues,

  InvestmentFormValues,

  MortgageFormValues,

} from "@/lib/form-types";

import type { GuidedSubmitOptions } from "@/components/guided/useSanityAck";
import { getSectionTheme, type SectionId } from "@/lib/section-theme";



export type { SectionId };



type Props = {

  section: SectionId;

  chatState: unknown;

  sanityError?: string | null;

  onClearSanityError?: () => void;

  onSubmit: (
    form: CarLoanFormValues | MortgageFormValues | InvestmentFormValues,
    options?: GuidedSubmitOptions
  ) => void;

  loading: boolean;

};



export function SectionGuidedIntake({

  section,

  chatState,

  sanityError,

  onClearSanityError,

  onSubmit,

  loading,

}: Props) {

  const theme = getSectionTheme(section);



  return (

    <FormThemeProvider section={section}>

      <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/80 shadow-lg shadow-slate-200/40 backdrop-blur-md">

        <div className={`${theme.shell.headerGradient} px-5 py-5 sm:px-7`}>

          <p className="text-xs font-medium uppercase tracking-wider text-white/75">

            Guided intake

          </p>

          <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">

            {theme.emoji} {theme.label}

          </h2>

          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/85">

            One question at a time. Rules decide — we&apos;ll explain clearly after.

          </p>

        </div>

        <div className="form-themed p-6 sm:p-8" data-section={section}>

          {section === "car-loan" ? (

            <CarLoanGuidedFlow

              chatState={chatState}

              onSubmit={onSubmit as (f: CarLoanFormValues) => void}

              loading={loading}

              externalError={sanityError}

              onClearExternalError={onClearSanityError}

            />

          ) : section === "mortgage" ? (

            <MortgageGuidedFlow

              chatState={chatState}

              onSubmit={onSubmit as (f: MortgageFormValues) => void}

              loading={loading}

              externalError={sanityError}

              onClearExternalError={onClearSanityError}

            />

          ) : (

            <InvestmentGuidedFlow

              chatState={chatState}

              onSubmit={onSubmit as (f: InvestmentFormValues) => void}

              loading={loading}

              externalError={sanityError}

              onClearExternalError={onClearSanityError}

            />

          )}

        </div>

      </div>

    </FormThemeProvider>

  );

}


