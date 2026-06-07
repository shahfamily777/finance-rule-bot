/**
 * Quick sanity checks on intake forms — catch typos and impossible ratios
 * before running loan math / assessments (saves work and avoids nonsense output).
 */

import { computeMonthlyLoanPayment, monthlyPrincipalAndInterest } from "@/lib/loan-math";
import type { CarLoanFormValues, InvestmentFormValues, MortgageFormValues } from "@/lib/form-types";

export type FormSanityResult =
  | { ok: true }
  | { ok: false; message: string };

export class FormSanityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormSanityError";
  }
}

function fail(message: string): FormSanityResult {
  return { ok: false, message };
}

/** First failed check wins — keeps messages focused. */
function first(...checks: FormSanityResult[]): FormSanityResult {
  for (const c of checks) {
    if (!c.ok) return c;
  }
  return { ok: true };
}

export function validateCarLoanInsuranceField(
  price: number,
  income: number,
  ins: number
): FormSanityResult {
  return first(
    ins > price * 0.02
      ? fail(
          `Monthly insurance ($${ins.toLocaleString()}) looks high for a $${price.toLocaleString()} car — that's over 2% of the car price **every month**. Did you mean **$${Math.round(ins / 10).toLocaleString()}** or **$${Math.round(ins / 12).toLocaleString()}/year**?`
        )
      : { ok: true },
    ins > income * 0.25
      ? fail(
          `Insurance at $${ins.toLocaleString()}/mo is more than 25% of your stated gross income ($${income.toLocaleString()}/mo). Double-check both numbers.`
        )
      : { ok: true }
  );
}

export function validateCarLoanForm(form: CarLoanFormValues): FormSanityResult {
  const {
    vehiclePrice: price,
    downPayment: down,
    grossMonthlyIncome: income,
    annualInterestRatePct: apr,
    loanTermMonths: term,
    monthlyInsurance: ins,
    monthlyFuel: fuel,
  } = form;

  return first(
    price <= 0 ? fail("Enter a valid vehicle price.") : { ok: true },
    income <= 0 ? fail("Enter a valid gross monthly income.") : { ok: true },
    down > price
      ? fail(
          `Down payment ($${down.toLocaleString()}) can't be more than the vehicle price ($${price.toLocaleString()}). Check those two fields.`
        )
      : { ok: true },
    income < 800
      ? fail(
          `$${income.toLocaleString()}/mo income looks too low — did you mean **annual** income, or is a digit missing?`
        )
      : { ok: true },
    apr <= 0 || apr > 30
      ? fail(`APR should be between about 0.1% and 30% — you entered ${apr}%.`)
      : { ok: true },
    term > 48
      ? fail("Loan term cannot exceed 48 months for our car loan rules.")
      : { ok: true },
    validateCarLoanInsuranceField(price, income, ins),
    fuel > income * 0.2
      ? fail(
          `Monthly ${form.fuelType === "ev" ? "EV charging" : "gas"} ($${fuel.toLocaleString()}) seems high vs income ($${income.toLocaleString()}/mo).`
        )
      : { ok: true },
    fuel > price * 0.05
      ? fail(
          `Monthly fuel/charging ($${fuel.toLocaleString()}) looks unusually high for a $${price.toLocaleString()} vehicle.`
        )
      : { ok: true },
    (() => {
      const principal = Math.max(0, price - down);
      if (principal <= 0) return { ok: true };
      const payment = computeMonthlyLoanPayment(principal, apr, term);
      const transport = payment + ins + fuel;
      if (transport > income * 0.5) {
        return fail(
          `Quick check: payment (~$${Math.round(payment).toLocaleString()}) + insurance + fuel ≈ **$${Math.round(transport).toLocaleString()}/mo** — over half your gross income. One of those numbers may be off.`
        );
      }
      if (price / income > 50) {
        return fail(
          `A $${price.toLocaleString()} car on $${income.toLocaleString()}/mo income is an extreme ratio — confirm price and **monthly gross** income.`
        );
      }
      return { ok: true };
    })()
  );
}

export function validateMortgageForm(form: MortgageFormValues): FormSanityResult {
  if (form.scenario === "refinance") {
    return first(
      form.currentRatePct <= 0 || form.currentRatePct > 25
        ? fail("Enter a realistic current mortgage rate (e.g. 6.5%).")
        : { ok: true },
      form.newRatePct <= 0 || form.newRatePct > 25
        ? fail("Enter a realistic new rate (e.g. 5.5%).")
        : { ok: true },
      form.newRatePct >= form.currentRatePct
        ? fail(
            "For a refinance check, the new rate should be **lower** than your current rate."
          )
        : { ok: true }
    );
  }

  const {
    homePrice: price,
    grossMonthlyIncome: income,
    downPayment: down,
    emergencyFund: ef,
    closingCosts: closing,
    interestRatePct: rate,
    loanTermYears: term,
    monthlyPropertyTax: tax,
    monthlyInsurance: ins,
    monthlyHoaMaintenance: hoa,
  } = form;

  const closingAmt = closing ?? Math.round(price * 0.03);
  const hoaAmt = hoa ?? 0;

  return first(
    price <= 0 ? fail("Enter a valid home purchase price.") : { ok: true },
    income <= 0 ? fail("Enter a valid gross monthly income.") : { ok: true },
    down > price
      ? fail(
          `Down payment ($${down.toLocaleString()}) can't exceed the home price ($${price.toLocaleString()}).`
        )
      : { ok: true },
    income < 1500
      ? fail(
          `$${income.toLocaleString()}/mo gross income seems too low — monthly gross, not annual?`
        )
      : { ok: true },
    rate <= 0 || rate > 25
      ? fail(`Mortgage rate should be roughly 0.1%–25% — you entered ${rate}%.`)
      : { ok: true },
    ins > price * 0.015
      ? fail(
          `Monthly insurance ($${ins.toLocaleString()}) looks way too high for a $${price.toLocaleString()} home (typical is often a few hundred per month, not thousands). Check for a typo — e.g. **annual** premium entered as monthly?`
        )
      : { ok: true },
    ins > income * 0.3
      ? fail(
          `Insurance at $${ins.toLocaleString()}/mo is more than 30% of gross income ($${income.toLocaleString()}/mo). That doesn't line up — please fix insurance or income.`
        )
      : { ok: true },
    tax > price * 0.008
      ? fail(
          `Monthly property tax ($${tax.toLocaleString()}) looks very high for a $${price.toLocaleString()} home. Did you mean **annual** tax, or a smaller monthly amount?`
        )
      : { ok: true },
    tax > income * 0.4
      ? fail(
          `Property tax ($${tax.toLocaleString()}/mo) can't reasonably be 40%+ of gross income ($${income.toLocaleString()}/mo).`
        )
      : { ok: true },
    hoaAmt > 0 && hoaAmt > income * 0.25
      ? fail(`HOA/maintenance ($${hoaAmt.toLocaleString()}/mo) looks too high vs income.`)
      : { ok: true },
    hoaAmt > price * 0.01
      ? fail(
          `HOA ($${hoaAmt.toLocaleString()}/mo) looks unusually large relative to a $${price.toLocaleString()} home.`
        )
      : { ok: true },
    tax + ins + hoaAmt > income * 0.6
      ? fail(
          `Tax ($${tax.toLocaleString()}) + insurance ($${ins.toLocaleString()})${hoaAmt > 0 ? ` + HOA ($${hoaAmt.toLocaleString()})` : ""} already exceed most of your $${income.toLocaleString()}/mo income — before the mortgage payment. One or more of these is likely wrong.`
        )
      : { ok: true },
    closingAmt > price * 0.12
      ? fail(
          `Closing costs ($${closingAmt.toLocaleString()}) look very high for a $${price.toLocaleString()} home (often ~2–5% of price).`
        )
      : { ok: true },
    ef > price * 0.5
      ? fail(
          `Emergency fund ($${ef.toLocaleString()}) seems larger than typical relative to this home price — confirm the amount.`
        )
      : { ok: true },
    (() => {
      const loan = Math.max(0, price - down);
      const pi = monthlyPrincipalAndInterest(loan, rate, term);
      const housing = pi + tax + ins + hoaAmt;
      const pct = (housing / income) * 100;
      if (housing > income) {
        return fail(
          `Even before our 35% rule: P&I (~$${Math.round(pi).toLocaleString()}) + tax + insurance${hoaAmt > 0 ? " + HOA" : ""} ≈ **$${Math.round(housing).toLocaleString()}/mo**, which is **more than** your gross income ($${income.toLocaleString()}/mo). Something's off — often insurance or tax is typed wrong.`
        );
      }
      if (pct > 55) {
        return fail(
          `These housing costs add up to about **${pct.toFixed(0)}%** of gross income before we finish the checklist — likely a typo in tax, insurance, income, or price.`
        );
      }
      if (price / income > 120) {
        return fail(
          `A $${price.toLocaleString()} home on $${income.toLocaleString()}/mo income is an unusual ratio — double-check both.`
        );
      }
      return { ok: true };
    })()
  );
}

export function validateInvestmentForm(form: InvestmentFormValues): FormSanityResult {
  const amt = form.investAmount;

  return first(
    amt !== null && amt < 0 ? fail("Investment amount can't be negative.") : { ok: true },
    amt !== null && amt > 0 && amt < 50
      ? fail("If you're investing a specific amount, enter at least $50 or leave it blank.")
      : { ok: true },
    amt !== null && amt > 50_000_000
      ? fail(
          `$${amt.toLocaleString()} is unusually large — confirm you didn't add extra zeros.`
        )
      : { ok: true },
    form.hasFullEmergencyFund && !form.hasStarterEmergencyFund
      ? fail(
          "You said you have a **full** emergency fund (3–6 months) but **not** even a starter fund (~$2k). Those usually go together — which is closer to your situation?"
        )
      : { ok: true },
    form.maxing401k && !form.has401kMatch
      ? fail(
          "You said you're **maxing your 401(k)** but also **no employer match** — that's possible (different plans), but confirm both answers are right."
        )
      : { ok: true },
    form.hasHighInterestDebt &&
      form.hasFullEmergencyFund &&
      !form.hasStarterEmergencyFund
      ? fail(
          "High-interest debt plus a full emergency fund, but no starter fund — pick the answers that best match today (we use the priority order in order)."
        )
      : { ok: true }
  );
}

export function assertCarLoanFormSanity(form: CarLoanFormValues): void {
  const r = validateCarLoanForm(form);
  if (!r.ok) throw new FormSanityError(r.message);
}

export function assertMortgageFormSanity(form: MortgageFormValues): void {
  const r = validateMortgageForm(form);
  if (!r.ok) throw new FormSanityError(r.message);
}

export function assertInvestmentFormSanity(form: InvestmentFormValues): void {
  const r = validateInvestmentForm(form);
  if (!r.ok) throw new FormSanityError(r.message);
}
