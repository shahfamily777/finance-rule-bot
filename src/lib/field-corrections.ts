/**
 * Detect user corrections and overwrite stored intake fields (not only fill nulls).
 */

import {
  parseAmountToken,
  parseAprPercent,
  parseDownPaymentAmount,
  parseGrossMonthlyIncome,
  parseIncomeShortReply,
  parsePurchasePrice,
  parseYesNo,
} from "@/lib/intake-policy";

export function looksLikeDataCorrection(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (
    /(?:i\s+meant|actually|correction|that'?s\s+wrong|let\s+me\s+fix|change\s+that|mistake|revert|update\s+that)/i.test(
      t
    )
  ) {
    return true;
  }
  if (
    /(?:don'?t|do not|no)\s+have\s+(?:a\s+)?(?:down\s*payment|down\b)|no\s+down\s*payment|without\s+down/i.test(
      t
    )
  ) {
    return true;
  }
  if (/only\s+(?:have\s+)?\$?\s*[\d,]+/i.test(t)) return true;
  if (/(?:wrong|incorrect)\s+(?:down|income|price|number)/i.test(t)) return true;
  return false;
}

function firstMoney(text: string): number | null {
  const m = text.match(/\$?\s*([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)/i);
  return m ? parseAmountToken(m[0]) : null;
}

export type MortgageData = {
  homePrice: number | null;
  grossMonthlyIncome: number | null;
  downPayment: number | null;
  closingCosts: number | null;
  emergencyFund: number | null;
  cashAvailable: number | null;
  loanTermYears: number | null;
  interestRatePct: number | null;
  monthlyPropertyTax: number | null;
  monthlyInsurance: number | null;
  monthlyHoaMaintenance: number | null;
};

/** Apply corrections from the latest user message; returns true if anything changed. */
export function applyMortgageCorrections(
  data: MortgageData,
  text: string
): { changed: boolean; note: string | null } {
  const t = text.trim();
  let changed = false;
  const notes: string[] = [];

  const onlyAmt = t.match(/only\s+(?:have\s+)?\$?\s*([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)/i);
  const onlyMoney = onlyAmt ? parseAmountToken(onlyAmt[1]) : firstMoney(t);

  const noDown =
    /(?:don'?t|do not|no)\s+have\s+(?:a\s+)?(?:down\s*payment|down\b)|no\s+down\s*payment|without\s+(?:a\s+)?down/i.test(
      t
    );

  if (noDown) {
    if (onlyMoney !== null) {
      if (data.downPayment !== onlyMoney) {
        data.downPayment = onlyMoney;
        changed = true;
      }
      if (data.cashAvailable !== onlyMoney) {
        data.cashAvailable = onlyMoney;
        changed = true;
      }
      notes.push(
        `down payment **$${onlyMoney.toLocaleString()}** (about ${data.homePrice ? ((onlyMoney / data.homePrice) * 100).toFixed(1) : "?"}% of price) and total cash on hand **$${onlyMoney.toLocaleString()}**`
      );
    } else {
      if (data.downPayment !== 0) {
        data.downPayment = 0;
        changed = true;
      }
      if (data.cashAvailable !== null) {
        data.cashAvailable = null;
        changed = true;
      }
      notes.push("no down payment");
    }
  }

  const newDown = parseDownPaymentAmount(t, data.homePrice);
  if (newDown !== null && !noDown) {
    if (data.downPayment !== newDown) {
      data.downPayment = newDown;
      changed = true;
      notes.push(`down payment **$${newDown.toLocaleString()}**`);
    }
    if (data.cashAvailable !== null) {
      data.cashAvailable = null;
      changed = true;
    }
  }

  if (onlyMoney !== null && !noDown && /only\s+/i.test(t) && newDown === null) {
    if (/(?:cash|saved|liquid)/i.test(t)) {
      if (data.cashAvailable !== onlyMoney) {
        data.cashAvailable = onlyMoney;
        changed = true;
        notes.push(`cash on hand **$${onlyMoney.toLocaleString()}**`);
      }
    }
  }

  const price = parsePurchasePrice(t, "home");
  if (price !== null && data.homePrice !== price) {
    data.homePrice = price;
    changed = true;
    notes.push(`purchase price **$${price.toLocaleString()}**`);
  }

  const income = parseGrossMonthlyIncome(t) ?? parseIncomeShortReply(t);
  if (income !== null && data.grossMonthlyIncome !== income) {
    data.grossMonthlyIncome = income;
    changed = true;
    notes.push(`income **$${income.toLocaleString()}/mo**`);
  }

  const rate = parseAprPercent(t);
  if (rate !== null && data.interestRatePct !== rate) {
    data.interestRatePct = rate;
    changed = true;
    notes.push(`interest rate **${rate}%**`);
  }

  if (/\b15\b/.test(t) && !/\b30\b/.test(t) && data.loanTermYears !== 15) {
    data.loanTermYears = 15;
    changed = true;
    notes.push("**15-year** term");
  }
  if (/\b30\b/.test(t) && data.loanTermYears !== 30) {
    data.loanTermYears = 30;
    changed = true;
    notes.push("**30-year** term");
  }

  const closing = t.match(/closing\s*\$?\s*([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)/i);
  if (closing) {
    const c = parseAmountToken(closing[1]);
    if (c !== null && data.closingCosts !== c) {
      data.closingCosts = c;
      changed = true;
      notes.push(`closing **$${c.toLocaleString()}**`);
    }
  }

  const ef = t.match(/emergency\s*\$?\s*([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)/i);
  if (ef) {
    const e = parseAmountToken(ef[1]);
    if (e !== null && data.emergencyFund !== e) {
      data.emergencyFund = e;
      changed = true;
      notes.push(`emergency fund **$${e.toLocaleString()}**`);
    }
  }

  const yn = parseYesNo(t);
  if (yn === false && data.cashAvailable !== 0) {
    data.cashAvailable = 0;
    changed = true;
    notes.push("not enough cash on hand");
  }

  const note =
    notes.length > 0
      ? `Updated: ${notes.join(", ")}.`
      : changed
        ? "Updated your numbers."
        : null;

  return { changed, note };
}

export type CarData = {
  vehiclePrice: number | null;
  downPayment: number | null;
  loanTermMonths: number | null;
  grossMonthlyIncome: number | null;
  annualInterestRatePct: number | null;
  monthlyInsurance: number | null;
  monthlyFuel: number | null;
  monthlyTransportTotal: number | null;
};

export function applyCarLoanCorrections(
  data: CarData,
  text: string
): { changed: boolean; note: string | null } {
  const t = text.trim();
  let changed = false;
  const notes: string[] = [];

  const price = parsePurchasePrice(t, "car");
  if (price !== null && data.vehiclePrice !== price) {
    data.vehiclePrice = price;
    changed = true;
    notes.push(`vehicle price **$${price.toLocaleString()}**`);
  }

  const newDown = parseDownPaymentAmount(t, data.vehiclePrice);
  if (newDown !== null && data.downPayment !== newDown) {
    data.downPayment = newDown;
    changed = true;
    notes.push(`down **$${newDown.toLocaleString()}**`);
  }

  const income = parseGrossMonthlyIncome(t) ?? parseIncomeShortReply(t);
  if (income !== null && data.grossMonthlyIncome !== income) {
    data.grossMonthlyIncome = income;
    changed = true;
    notes.push(`income **$${income.toLocaleString()}/mo**`);
  }

  const rate = parseAprPercent(t);
  if (rate !== null && data.annualInterestRatePct !== rate) {
    data.annualInterestRatePct = rate;
    changed = true;
    notes.push(`APR **${rate}%**`);
  }

  const note =
    notes.length > 0 ? `Updated: ${notes.join(", ")}.` : changed ? "Updated your numbers." : null;
  return { changed, note };
}
