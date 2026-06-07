"use client";



import { GuidedStepShell } from "@/components/guided/GuidedStepShell";

import { parseNum } from "@/components/guided/parse-amount";

import { useGuidedFormErrors } from "@/components/guided/useGuidedFormErrors";
import {
  useSanityAck,
  type GuidedSubmitOptions,
} from "@/components/guided/useSanityAck";

import { IntakeYesNo } from "@/components/intake-fields";

import type { InvestmentFormValues } from "@/lib/form-types";

import { validateInvestmentForm } from "@/lib/form-sanity";

import {
  investmentGuidedStepForError,
  validateInvestmentGuidedStep,
} from "@/lib/guided-sanity";

import { investmentFormFromState } from "@/lib/form-from-state";

import type { ConversationState } from "@/lib/conversation";

import { INTAKE_INPUT } from "@/lib/section-theme";

import { useState } from "react";



const STEP_IDS = [

  "invest_amount",

  "match",

  "starter_emergency",

  "high_interest_debt",

  "full_emergency",

  "hsa",

  "roth",

  "max_401k",

] as const;



const TOTAL = STEP_IDS.length;



const QUESTIONS: Record<(typeof STEP_IDS)[number], string> = {

  invest_amount: "How much are you thinking of investing? (optional)",

  match: "Do you have a 401(k) with an employer match?",

  starter_emergency: "Do you have at least about $2,000 in a starter emergency fund?",

  high_interest_debt: "Do you have high-interest debt (credit cards, personal loans)?",

  full_emergency: "Do you have a full emergency fund (about 3–6 months of expenses)?",

  hsa: "Are you eligible for an HSA (high-deductible health plan)?",

  roth: "Do you contribute to a Roth IRA (or plan to this year)?",

  max_401k: "Are you maxing out your 401(k) annual contributions?",

};



export function InvestmentGuidedFlow({

  chatState,

  onSubmit,

  loading,

  externalError,

  onClearExternalError,

}: {

  chatState: unknown;

  onSubmit: (form: InvestmentFormValues, options?: GuidedSubmitOptions) => void;

  loading: boolean;

  externalError?: string | null;

  onClearExternalError?: () => void;

}) {

  const initial = investmentFormFromState(chatState as ConversationState | null);

  const [step, setStep] = useState(0);

  const [investAmount, setInvestAmount] = useState(

    initial?.investAmount != null ? String(initial.investAmount) : ""

  );

  const [has401kMatch, setHas401kMatch] = useState<boolean | null>(

    initial?.has401kMatch ?? null

  );

  const [hasStarterEmergencyFund, setHasStarterEmergencyFund] = useState<boolean | null>(

    initial?.hasStarterEmergencyFund ?? null

  );

  const [hasHighInterestDebt, setHasHighInterestDebt] = useState<boolean | null>(

    initial?.hasHighInterestDebt ?? null

  );

  const [hasFullEmergencyFund, setHasFullEmergencyFund] = useState<boolean | null>(

    initial?.hasFullEmergencyFund ?? null

  );

  const [hsaEligible, setHsaEligible] = useState<boolean | null>(

    initial?.hsaEligible ?? null

  );

  const [hasRothIra, setHasRothIra] = useState<boolean | null>(initial?.hasRothIra ?? null);

  const [maxing401k, setMaxing401k] = useState<boolean | null>(initial?.maxing401k ?? null);



  const { displayError, setError, dismissErrors } = useGuidedFormErrors(
    externalError,
    onClearExternalError
  );
  const { warnOrProceed, resetAll } = useSanityAck();

  function dismissAll() {
    dismissErrors();
    resetAll();
  }

  const wrapChange =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      dismissAll();
      setter(v);
    };



  const stepId = STEP_IDS[step];



  function partialPayload(): Partial<InvestmentFormValues> {

    return {

      has401kMatch: has401kMatch ?? undefined,

      hasStarterEmergencyFund: hasStarterEmergencyFund ?? undefined,

      hasHighInterestDebt: hasHighInterestDebt ?? undefined,

      hasFullEmergencyFund: hasFullEmergencyFund ?? undefined,

      hsaEligible: hsaEligible ?? undefined,

      hasRothIra: hasRothIra ?? undefined,

      maxing401k: maxing401k ?? undefined,

    };

  }



  function handleSanity(message: string, onProceed: () => void) {
    if (warnOrProceed(message, setError)) {
      const target = investmentGuidedStepForError(message);
      if (target !== step) {
        setStep(() => target);
      }
      return;
    }
    setError(null);
    onProceed();
  }

  function goNext() {
    onClearExternalError?.();

    if (stepId === "invest_amount") {

      if (investAmount.trim() && parseNum(investAmount) === null) {

        setError("Enter a valid amount or leave blank.");

        return;

      }

      const amt = investAmount.trim() ? parseNum(investAmount) : null;

      const stepSanity = validateInvestmentGuidedStep(

        "invest_amount",

        amt,

        partialPayload()

      );

      if (!stepSanity.ok) {
        handleSanity(stepSanity.message, () => setStep((s) => s + 1));
        return;
      }

      setError(null);
      setStep((s) => s + 1);

      return;

    }

    const checks: (boolean | null)[] = [

      has401kMatch,

      hasStarterEmergencyFund,

      hasHighInterestDebt,

      hasFullEmergencyFund,

      hsaEligible,

      hasRothIra,

      maxing401k,

    ];

    const idx = step - 1;

    if (idx >= 0 && checks[idx] === null) {

      setError("Choose yes or no to continue.");

      return;

    }

    if (step < TOTAL - 1) {
      setError(null);
      setStep((s) => s + 1);
      return;
    }

    if (checks.some((c) => c === null)) {

      setError("Answer each question.");

      return;

    }

    const payload = {

      investAmount: investAmount.trim() ? parseNum(investAmount) : null,

      has401kMatch: has401kMatch!,

      hasStarterEmergencyFund: hasStarterEmergencyFund!,

      hasHighInterestDebt: hasHighInterestDebt!,

      hasFullEmergencyFund: hasFullEmergencyFund!,

      hsaEligible: hsaEligible!,

      hasRothIra: hasRothIra!,

      maxing401k: maxing401k!,

    };

    const sanity = validateInvestmentForm(payload);

    if (!sanity.ok) {
      handleSanity(sanity.message, () =>
        onSubmit(payload, { sanityAcknowledged: true })
      );
      return;
    }

    onSubmit(payload);

  }



  function goBack() {
    dismissAll();
    setStep((s) => s - 1);
  }



  const yesNo = (setter: (v: boolean) => void) => (v: boolean) => {
    dismissAll();
    setter(v);
  };



  return (

    <GuidedStepShell

      section="investment"

      stepIndex={step + 1}

      stepTotal={TOTAL}

      stepId={stepId}

      title={QUESTIONS[stepId]}

      subtitle={

        stepId === "invest_amount"

          ? "Skip if you only want the priority order for future dollars."

          : undefined

      }

      error={displayError}

      onBack={step > 0 ? goBack : undefined}

      onNext={goNext}

      loading={loading}

      isFirst={step === 0}

      isLast={step === TOTAL - 1}

    >

      {stepId === "invest_amount" ? (

        <input

          className={INTAKE_INPUT}

          value={investAmount}

          onChange={(e) => wrapChange(setInvestAmount)(e.target.value)}

          placeholder="Optional — e.g. 10000"

          autoFocus

        />

      ) : stepId === "match" ? (

        <IntakeYesNo

          id="match"

          label=""

          value={has401kMatch}

          onChange={yesNo(setHas401kMatch)}

        />

      ) : stepId === "starter_emergency" ? (

        <IntakeYesNo

          id="starter"

          label=""

          value={hasStarterEmergencyFund}

          onChange={yesNo(setHasStarterEmergencyFund)}

        />

      ) : stepId === "high_interest_debt" ? (

        <IntakeYesNo

          id="debt"

          label=""

          value={hasHighInterestDebt}

          onChange={yesNo(setHasHighInterestDebt)}

        />

      ) : stepId === "full_emergency" ? (

        <IntakeYesNo

          id="full"

          label=""

          value={hasFullEmergencyFund}

          onChange={yesNo(setHasFullEmergencyFund)}

        />

      ) : stepId === "hsa" ? (

        <IntakeYesNo id="hsa" label="" value={hsaEligible} onChange={yesNo(setHsaEligible)} />

      ) : stepId === "roth" ? (

        <IntakeYesNo id="roth" label="" value={hasRothIra} onChange={yesNo(setHasRothIra)} />

      ) : (

        <IntakeYesNo id="max" label="" value={maxing401k} onChange={yesNo(setMaxing401k)} />

      )}

    </GuidedStepShell>

  );

}


