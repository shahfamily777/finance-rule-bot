/** Standard fixed-rate amortization: monthly payment from principal, APR, and term. */
export function computeMonthlyLoanPayment(
  principal: number,
  annualRatePct: number,
  termMonths: number
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  if (annualRatePct <= 0) return principal / termMonths;
  const r = annualRatePct / 100 / 12;
  const factor = Math.pow(1 + r, termMonths);
  return (principal * r * factor) / (factor - 1);
}

export function monthlyPrincipalAndInterest(
  loanAmount: number,
  annualRatePct: number,
  termYears: number
): number {
  if (loanAmount <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return loanAmount / n;
  return (loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}
