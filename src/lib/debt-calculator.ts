export type PayoffResult =
  | {
      ok: true;
      monthsRemaining: number;
      totalInterestPaid: number;
      payoffDate: Date;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Amortization-based payoff estimate for a single debt.
 * Deterministic — no external data.
 */
export function calculatePayoffDate(
  balance: number,
  annualInterestRatePct: number,
  monthlyPayment: number
): PayoffResult {
  if (balance <= 0) {
    return { ok: false, error: "Balance must be greater than zero." };
  }
  if (monthlyPayment <= 0) {
    return { ok: false, error: "Monthly payment must be greater than zero." };
  }
  if (annualInterestRatePct < 0) {
    return { ok: false, error: "Interest rate cannot be negative." };
  }

  const monthlyRate = annualInterestRatePct / 100 / 12;
  let remaining = balance;
  let months = 0;
  let totalInterest = 0;
  const maxMonths = 600;

  while (remaining > 0.01 && months < maxMonths) {
    const interest = monthlyRate > 0 ? remaining * monthlyRate : 0;
    if (monthlyPayment <= interest && monthlyRate > 0) {
      return {
        ok: false,
        error:
          "Monthly payment is too low to cover interest — the balance would never be paid off.",
      };
    }
    totalInterest += interest;
    remaining = remaining + interest - monthlyPayment;
    months++;
  }

  if (months >= maxMonths) {
    return {
      ok: false,
      error: "Payoff would take more than 50 years at this payment — increase the monthly amount.",
    };
  }

  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + months);

  return {
    ok: true,
    monthsRemaining: months,
    totalInterestPaid: Math.round(totalInterest * 100) / 100,
    payoffDate,
  };
}

export function formatPayoffDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}
