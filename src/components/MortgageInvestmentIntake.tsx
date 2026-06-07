"use client";

import {
  FormError,
  IntakeField,
  IntakeMoneyInput,
  IntakeSubmit,
  IntakeYesNo,
} from "@/components/intake-fields";
import type { InvestmentFormValues, MortgageFormValues } from "@/lib/form-types";
import { validateInvestmentForm, validateMortgageForm } from "@/lib/form-sanity";
import { INTAKE_INPUT } from "@/lib/section-theme";
import { useState } from "react";

function parseNum(raw: string): number | null {
  const t = raw.replace(/,/g, "").trim();
  if (!t) return null;
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(k|m)?$/i);
  if (!m) {
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  let n = Number(m[1]);
  const s = (m[2] || "").toLowerCase();
  if (s === "k") n *= 1000;
  if (s === "m") n *= 1_000_000;
  return Number.isFinite(n) ? n : null;
}

export function MortgageIntakeForm({
  initial,
  onSubmit,
  loading,
}: {
  initial: Partial<MortgageFormValues> | null;
  onSubmit: (form: MortgageFormValues) => void;
  loading: boolean;
}) {
  const [scenario, setScenario] = useState<"purchase" | "refinance">(
    initial?.scenario ?? "purchase"
  );
  const [homePrice, setHomePrice] = useState(
    initial && "homePrice" in initial ? String(initial.homePrice ?? "") : ""
  );
  const [grossMonthlyIncome, setGrossMonthlyIncome] = useState(
    initial && "grossMonthlyIncome" in initial ? String(initial.grossMonthlyIncome ?? "") : ""
  );
  const [downPayment, setDownPayment] = useState(
    initial && "downPayment" in initial ? String(initial.downPayment ?? "") : ""
  );
  const [emergencyFund, setEmergencyFund] = useState(
    initial && "emergencyFund" in initial ? String(initial.emergencyFund ?? "") : ""
  );
  const [closingCosts, setClosingCosts] = useState(
    initial && "closingCosts" in initial && initial.closingCosts != null
      ? String(initial.closingCosts)
      : ""
  );
  const [cashReady, setCashReady] = useState<"yes" | "no" | "">(
    initial && "cashReady" in initial ? (initial.cashReady ?? "") : ""
  );
  const [cashAvailable, setCashAvailable] = useState(
    initial && "cashAvailable" in initial && initial.cashAvailable != null
      ? String(initial.cashAvailable)
      : ""
  );
  const [interestRatePct, setInterestRatePct] = useState(
    initial && "interestRatePct" in initial ? String(initial.interestRatePct ?? "") : ""
  );
  const [loanTermYears, setLoanTermYears] = useState<15 | 30>(
    initial && "loanTermYears" in initial ? (initial.loanTermYears as 15 | 30) : 30
  );
  const [monthlyPropertyTax, setMonthlyPropertyTax] = useState(
    initial && "monthlyPropertyTax" in initial
      ? String(initial.monthlyPropertyTax ?? "")
      : ""
  );
  const [monthlyInsurance, setMonthlyInsurance] = useState(
    initial && "monthlyInsurance" in initial ? String(initial.monthlyInsurance ?? "") : ""
  );
  const [monthlyHoa, setMonthlyHoa] = useState(
    initial && "monthlyHoaMaintenance" in initial && initial.monthlyHoaMaintenance != null
      ? String(initial.monthlyHoaMaintenance)
      : ""
  );
  const [currentRatePct, setCurrentRatePct] = useState(
    initial && "currentRatePct" in initial ? String(initial.currentRatePct ?? "") : ""
  );
  const [newRatePct, setNewRatePct] = useState(
    initial && "newRatePct" in initial ? String(initial.newRatePct ?? "") : ""
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (scenario === "refinance") {
      const cur = parseNum(currentRatePct);
      const neu = parseNum(newRatePct);
      if (cur === null || neu === null) {
        setError("Enter current and new rates.");
        return;
      }
      const refinancePayload = {
        scenario: "refinance" as const,
        currentRatePct: cur,
        newRatePct: neu,
        loanTermYears,
      };
      const refinanceSanity = validateMortgageForm(refinancePayload);
      if (!refinanceSanity.ok) {
        setError(refinanceSanity.message);
        return;
      }
      onSubmit(refinancePayload);
      return;
    }
    const hp = parseNum(homePrice);
    const income = parseNum(grossMonthlyIncome);
    const down = parseNum(downPayment);
    const ef = parseNum(emergencyFund);
    const rate = parseNum(interestRatePct);
    const tax = parseNum(monthlyPropertyTax);
    const ins = parseNum(monthlyInsurance);
    const hoaRaw = monthlyHoa.trim();
    const hoa = hoaRaw ? parseNum(hoaRaw) : null;
    if (
      hp === null ||
      income === null ||
      down === null ||
      ef === null ||
      rate === null ||
      tax === null ||
      ins === null
    ) {
      setError("Fill all required purchase fields, including property tax and insurance.");
      return;
    }
    if (hoaRaw && hoa === null) {
      setError("HOA must be a valid number, or leave blank if none.");
      return;
    }
    if (!cashReady) {
      setError("Select whether you have enough cash saved.");
      return;
    }
    let cashAmt: number | null = null;
    if (cashReady === "no") {
      cashAmt = parseNum(cashAvailable);
      if (cashAmt === null) {
        setError("Enter how much cash you have.");
        return;
      }
    }
    const purchasePayload = {
      scenario: "purchase" as const,
      homePrice: hp,
      grossMonthlyIncome: income,
      downPayment: down,
      emergencyFund: ef,
      closingCosts: closingCosts.trim() ? parseNum(closingCosts) : null,
      cashReady,
      cashAvailable: cashAmt,
      interestRatePct: rate,
      loanTermYears,
      monthlyPropertyTax: tax,
      monthlyInsurance: ins,
      monthlyHoaMaintenance: hoaRaw ? hoa : null,
    };
    const purchaseSanity = validateMortgageForm(purchasePayload);
    if (!purchaseSanity.ok) {
      setError(purchaseSanity.message);
      return;
    }
    onSubmit(purchasePayload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <IntakeField id="scenario" label="Buying or refinancing?">
        <select
          id="scenario"
          value={scenario}
          onChange={(e) => setScenario(e.target.value as "purchase" | "refinance")}
          className={INTAKE_INPUT}
        >
          <option value="purchase">Buying a home</option>
          <option value="refinance">Refinancing</option>
        </select>
      </IntakeField>
      {scenario === "refinance" ? (
        <>
          <IntakeField id="cur" label="Current rate (%)">
            <input
              id="cur"
              value={currentRatePct}
              onChange={(e) => setCurrentRatePct(e.target.value)}
              className={INTAKE_INPUT}
              required
            />
          </IntakeField>
          <IntakeField id="new" label="New rate (%)">
            <input
              id="new"
              value={newRatePct}
              onChange={(e) => setNewRatePct(e.target.value)}
              className={INTAKE_INPUT}
              required
            />
          </IntakeField>
          <IntakeField id="rt" label="Term">
            <select
              id="rt"
              value={loanTermYears}
              onChange={(e) => setLoanTermYears(Number(e.target.value) as 15 | 30)}
              className={INTAKE_INPUT}
            >
              <option value={15}>15 years</option>
              <option value={30}>30 years</option>
            </select>
          </IntakeField>
        </>
      ) : (
        <>
          <IntakeMoneyInput id="hp" label="Home price" value={homePrice} onChange={setHomePrice} />
          <IntakeMoneyInput
            id="inc"
            label="Gross monthly income"
            value={grossMonthlyIncome}
            onChange={setGrossMonthlyIncome}
          />
          <IntakeMoneyInput id="dn" label="Down payment" value={downPayment} onChange={setDownPayment} />
          <IntakeMoneyInput
            id="ef"
            label="Emergency fund (after closing)"
            value={emergencyFund}
            onChange={setEmergencyFund}
          />
          <IntakeMoneyInput
            id="cc"
            label="Closing costs"
            value={closingCosts}
            onChange={setClosingCosts}
            hint="Leave blank to estimate ~3% of price."
            optional
          />
          <IntakeField id="cash" label="Enough cash for down + closing + emergency fund?">
            <select
              id="cash"
              value={cashReady}
              onChange={(e) => setCashReady(e.target.value as "yes" | "no")}
              className={INTAKE_INPUT}
              required
            >
              <option value="">Select…</option>
              <option value="yes">Yes — saved, not borrowed</option>
              <option value="no">No / only part</option>
            </select>
          </IntakeField>
          {cashReady === "no" ? (
            <IntakeMoneyInput
              id="cashamt"
              label="Cash available"
              value={cashAvailable}
              onChange={setCashAvailable}
            />
          ) : null}
          <IntakeField id="rate" label="Mortgage rate (%)">
            <input
              id="rate"
              value={interestRatePct}
              onChange={(e) => setInterestRatePct(e.target.value)}
              className={INTAKE_INPUT}
              required
            />
          </IntakeField>
          <IntakeField id="term" label="Loan term">
            <select
              id="term"
              value={loanTermYears}
              onChange={(e) => setLoanTermYears(Number(e.target.value) as 15 | 30)}
              className={INTAKE_INPUT}
            >
              <option value={15}>15 years</option>
              <option value={30}>30 years</option>
            </select>
          </IntakeField>
          <IntakeMoneyInput
            id="propTax"
            label="Monthly property tax"
            value={monthlyPropertyTax}
            onChange={setMonthlyPropertyTax}
            hint="Required — use your actual quote or escrow estimate for this home."
          />
          <IntakeMoneyInput
            id="homeIns"
            label="Monthly homeowners insurance"
            value={monthlyInsurance}
            onChange={setMonthlyInsurance}
            hint="Required — not estimated from home price."
          />
          <IntakeMoneyInput
            id="hoa"
            label="Monthly HOA / maintenance (optional)"
            value={monthlyHoa}
            onChange={setMonthlyHoa}
            hint="Leave blank if none. We do not assume HOA or maintenance costs."
            optional
          />
        </>
      )}
      {error ? <FormError message={error} /> : null}
      <IntakeSubmit loading={loading}>
        {loading ? "Running assessment…" : "Get my mortgage assessment"}
      </IntakeSubmit>
    </form>
  );
}

export function InvestmentIntakeForm({
  initial,
  onSubmit,
  loading,
}: {
  initial: Partial<InvestmentFormValues> | null;
  onSubmit: (form: InvestmentFormValues) => void;
  loading: boolean;
}) {
  const [investAmount, setInvestAmount] = useState(
    initial?.investAmount != null ? String(initial.investAmount) : ""
  );
  const [has401kMatch, setHas401kMatch] = useState<boolean | null>(initial?.has401kMatch ?? null);
  const [hasStarterEmergencyFund, setHasStarterEmergencyFund] = useState<boolean | null>(
    initial?.hasStarterEmergencyFund ?? null
  );
  const [hasHighInterestDebt, setHasHighInterestDebt] = useState<boolean | null>(
    initial?.hasHighInterestDebt ?? null
  );
  const [hasFullEmergencyFund, setHasFullEmergencyFund] = useState<boolean | null>(
    initial?.hasFullEmergencyFund ?? null
  );
  const [hsaEligible, setHsaEligible] = useState<boolean | null>(initial?.hsaEligible ?? null);
  const [hasRothIra, setHasRothIra] = useState<boolean | null>(initial?.hasRothIra ?? null);
  const [maxing401k, setMaxing401k] = useState<boolean | null>(initial?.maxing401k ?? null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const checks = [
      has401kMatch,
      hasStarterEmergencyFund,
      hasHighInterestDebt,
      hasFullEmergencyFund,
      hsaEligible,
      hasRothIra,
      maxing401k,
    ];
    if (checks.some((c) => c === null)) {
      setError("Answer every yes/no question.");
      return;
    }
    const amt = investAmount.trim() ? parseNum(investAmount) : null;
    if (investAmount.trim() && amt === null) {
      setError("Enter a valid investment amount, or leave it blank.");
      return;
    }
    const payload = {
      investAmount: amt,
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
      setError(sanity.message);
      return;
    }
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <IntakeMoneyInput
        id="amt"
        label="Amount to invest (optional)"
        value={investAmount}
        onChange={setInvestAmount}
        optional
      />
      <IntakeYesNo id="m" label="401(k) employer match?" value={has401kMatch} onChange={setHas401kMatch} />
      <IntakeYesNo
        id="se"
        label="~$2,000 starter emergency fund?"
        value={hasStarterEmergencyFund}
        onChange={setHasStarterEmergencyFund}
      />
      <IntakeYesNo
        id="hd"
        label="High-interest debt?"
        value={hasHighInterestDebt}
        onChange={setHasHighInterestDebt}
      />
      <IntakeYesNo
        id="fe"
        label="Full emergency fund (3–6 months)?"
        value={hasFullEmergencyFund}
        onChange={setHasFullEmergencyFund}
      />
      <IntakeYesNo id="hsa" label="HSA eligible (HDHP)?" value={hsaEligible} onChange={setHsaEligible} />
      <IntakeYesNo id="roth" label="Roth IRA contributions?" value={hasRothIra} onChange={setHasRothIra} />
      <IntakeYesNo id="max" label="Maxing 401(k)?" value={maxing401k} onChange={setMaxing401k} />
      {error ? <FormError message={error} /> : null}
      <IntakeSubmit loading={loading}>
        {loading ? "Building plan…" : "Get my priority plan"}
      </IntakeSubmit>
    </form>
  );
}
