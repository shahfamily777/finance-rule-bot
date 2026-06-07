import {
  intakeAcknowledgment,
  parseAprPercent,
  parseDownPaymentAmount,
  parseGrossMonthlyIncome,
  parseIncomeShortReply,
  parsePurchasePrice,
  parseYesNo,
} from "@/lib/intake-policy";
import {
  acknowledgeLastConcern,
  autoResolveMortgageConcerns,
  pickMortgageConcern,
} from "@/lib/conversational-intake";
import {
  applyMortgageCorrections,
  looksLikeDataCorrection,
} from "@/lib/field-corrections";
import { mortgageAssessmentAnswer } from "@/lib/assessment-mortgage";
import { monthlyPrincipalAndInterest } from "@/lib/loan-math";
import { MORTGAGE_RULES } from "@/lib/mortgage-rules";
import { tryDirectSectionAnswer } from "@/lib/section-qa";

export type Msg = { role: "user" | "assistant"; content: string };

export type MortgageStage =
  | "scenario"
  | "home_price"
  | "gross_income"
  | "down_payment"
  | "closing_costs"
  | "emergency_fund"
  | "cash_available"
  | "interest_rate"
  | "loan_term"
  | "property_tax"
  | "insurance"
  | "hoa_maintenance"
  | "current_rate"
  | "new_rate"
  | null;

export type MortgageConversationState = {
  intakeComplete?: boolean;
  stage: MortgageStage;
  addressedConcerns?: string[];
  lastConcernShown?: string;
  data: {
    isRefinance: boolean | null;
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
    currentRatePct: number | null;
    newRatePct: number | null;
  };
};

type MortgagePartial = Partial<MortgageConversationState["data"]>;
type FlowResult = { answer: string; state: MortgageConversationState };

const R = MORTGAGE_RULES;

function parseAmountToken(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  const m = cleaned.match(/\$?\s*(\d+(?:\.\d+)?)(?:\s*(k|m|b)\b)?/i);
  if (!m) return null;
  const base = Number(m[1]);
  if (!Number.isFinite(base)) return null;
  const suffix = (m[2] || "").toLowerCase();
  const mult =
    suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : suffix === "b" ? 1_000_000_000 : 1;
  return base * mult;
}

function firstAmount(text: string, pattern: RegExp): number | null {
  const m = text.match(pattern);
  if (!m?.[1]) return null;
  return parseAmountToken(m[1]);
}

function parseFirstMoneyAmount(text: string): number | null {
  const m = text.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*(k|m|b)?/i);
  if (!m) return null;
  return parseAmountToken(m[0]);
}

function parsePercent(text: string, pattern: RegExp): number | null {
  const m = text.match(pattern);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function extractMortgageSignals(text: string): MortgagePartial {
  const out: MortgagePartial = {};

  if (/(refinanc|refi\b)/i.test(text)) out.isRefinance = true;
  if (
    /(buy(?:ing)?\s+a\s+home|first\s+home|purchase\s+price|home\s+price|house\s+price|new\s+home)/i.test(
      text
    )
  )
    out.isRefinance = false;

  out.homePrice = parsePurchasePrice(text, "home");
  out.grossMonthlyIncome = parseGrossMonthlyIncome(text);
  out.downPayment = parseDownPaymentAmount(text, out.homePrice ?? null);

  out.closingCosts =
    firstAmount(text, /(?:closing\s*costs?)\s*\$?\s*([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)/i) ?? null;

  out.emergencyFund =
    firstAmount(text, /(?:emergency\s*fund)\s*\$?\s*([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)/i) ?? null;

  out.cashAvailable =
    firstAmount(
      text,
      /(?:cash\s*(?:on\s*hand|available|saved)|have\s*saved|total\s*cash)\s*\$?\s*([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)/i
    ) ?? null;

  const term15 = /\b15\s*[-\s]?years?\b/i.test(text);
  const term30 = /\b30\s*[-\s]?years?\b/i.test(text);
  if (term15) out.loanTermYears = 15;
  if (term30) out.loanTermYears = 30;

  out.interestRatePct = parseAprPercent(text);

  out.monthlyPropertyTax =
    firstAmount(text, /(?:property\s*tax|taxes)\s*\$?\s*([\d,]+(?:\.\d+)?)/i) ??
    (() => {
      const annual = firstAmount(text, /(?:property\s*tax|taxes)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:\/?\s*year|annual)/i);
      return annual !== null ? annual / 12 : null;
    })();

  out.monthlyInsurance =
    firstAmount(text, /(?:homeowners?\s+)?insurance\s*\$?\s*([\d,]+(?:\.\d+)?)/i) ?? null;

  out.monthlyHoaMaintenance =
    firstAmount(text, /(?:hoa|maintenance|repairs?)\s*\$?\s*([\d,]+(?:\.\d+)?)/i) ?? null;

  out.currentRatePct =
    parsePercent(text, /(?:current\s*rate|existing\s*rate)\s*(\d+(?:\.\d+)?)\s*%?/i) ?? null;

  out.newRatePct =
    parsePercent(text, /(?:new\s*rate|offered\s*rate)\s*(\d+(?:\.\d+)?)\s*%?/i) ?? null;

  return out;
}

function mergeKnown(
  base: MortgageConversationState["data"],
  next: MortgagePartial
): MortgageConversationState["data"] {
  const merged = { ...base };
  for (const [k, v] of Object.entries(next)) {
    const key = k as keyof MortgageConversationState["data"];
    if (v === undefined || v === null) continue;
    if (merged[key] === null) merged[key] = v as never;
  }
  return merged;
}

function initMortgageState(
  incoming?: MortgageConversationState | null
): MortgageConversationState {
  if (incoming && typeof incoming === "object" && incoming.data) return incoming;
  return {
    stage: null,
    data: {
      isRefinance: null,
      homePrice: null,
      grossMonthlyIncome: null,
      downPayment: null,
      closingCosts: null,
      emergencyFund: null,
      cashAvailable: null,
      loanTermYears: null,
      interestRatePct: null,
      monthlyPropertyTax: null,
      monthlyInsurance: null,
      monthlyHoaMaintenance: null,
      currentRatePct: null,
      newRatePct: null,
    },
  };
}

export function isMortgageFlowActive(
  state: MortgageConversationState | null | undefined
): boolean {
  if (!state?.data) return Boolean(state?.stage);
  const d = state.data;
  return (
    state.stage !== null ||
    d.isRefinance !== null ||
    d.homePrice !== null ||
    d.grossMonthlyIncome !== null ||
    d.downPayment !== null ||
    d.closingCosts !== null ||
    d.emergencyFund !== null ||
    d.cashAvailable !== null ||
    d.loanTermYears !== null ||
    d.interestRatePct !== null ||
    d.monthlyPropertyTax !== null ||
    d.monthlyInsurance !== null ||
    d.currentRatePct !== null ||
    d.newRatePct !== null
  );
}

function estimateClosingCosts(homePrice: number): number {
  return Math.round(homePrice * (R.ESTIMATED_CLOSING_COST_PCT / 100));
}

function estimateMonthlyTax(homePrice: number): number {
  return Math.round((homePrice * 0.012) / 12);
}

function estimateMonthlyInsurance(homePrice: number): number {
  return Math.round((homePrice * 0.0035) / 12);
}

function downPaymentPct(d: MortgageConversationState["data"]): number | null {
  if (d.homePrice === null || d.downPayment === null || d.homePrice <= 0) return null;
  return (d.downPayment / d.homePrice) * 100;
}

function requiredCashTotal(d: MortgageConversationState["data"]): number | null {
  if (d.downPayment === null || d.emergencyFund === null || d.homePrice === null) return null;
  const closing = d.closingCosts ?? estimateClosingCosts(d.homePrice);
  return d.downPayment + closing + d.emergencyFund;
}

function syncMortgageSignalsFromThread(
  state: MortgageConversationState,
  thread: Msg[]
): void {
  const blob = thread
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
  state.data = mergeKnown(state.data, extractMortgageSignals(blob));
}

export function assessMortgageState(state: MortgageConversationState): FlowResult {
  return {
    answer: mortgageAssessmentAnswer(state),
    state: { ...state, stage: null },
  };
}

export function mortgageStateFromForm(
  form: import("@/lib/form-types").MortgageFormValues
): MortgageConversationState {
  if (form.scenario === "refinance") {
    return {
      stage: null,
      data: {
        isRefinance: true,
        homePrice: null,
        grossMonthlyIncome: null,
        downPayment: null,
        closingCosts: null,
        emergencyFund: null,
        cashAvailable: null,
        loanTermYears: form.loanTermYears,
        interestRatePct: null,
        monthlyPropertyTax: null,
        monthlyInsurance: null,
        monthlyHoaMaintenance: null,
        currentRatePct: form.currentRatePct,
        newRatePct: form.newRatePct,
      },
    };
  }

  const closing =
    form.closingCosts ??
    (form.homePrice > 0 ? estimateClosingCosts(form.homePrice) : null);
  const required =
    form.downPayment + (closing ?? 0) + form.emergencyFund;
  const cashAvailable =
    form.cashReady === "yes"
      ? required
      : form.cashAvailable ?? 0;

  return {
    stage: null,
    data: {
      isRefinance: false,
      homePrice: form.homePrice,
      grossMonthlyIncome: form.grossMonthlyIncome,
      downPayment: form.downPayment,
      closingCosts: closing,
      emergencyFund: form.emergencyFund,
      cashAvailable,
      loanTermYears: form.loanTermYears,
      interestRatePct: form.interestRatePct,
      monthlyPropertyTax: form.monthlyPropertyTax,
      monthlyInsurance: form.monthlyInsurance,
      monthlyHoaMaintenance: form.monthlyHoaMaintenance,
      currentRatePct: null,
      newRatePct: null,
    },
  };
}

function monthlyHoaAmount(d: MortgageConversationState["data"]): number {
  return d.monthlyHoaMaintenance ?? 0;
}

function resolveTaxAndInsurance(
  d: MortgageConversationState["data"],
  allowEstimate: boolean
): { tax: number | null; ins: number | null } {
  const tax =
    d.monthlyPropertyTax ??
    (allowEstimate && d.homePrice !== null ? estimateMonthlyTax(d.homePrice) : null);
  const ins =
    d.monthlyInsurance ??
    (allowEstimate && d.homePrice !== null ? estimateMonthlyInsurance(d.homePrice) : null);
  return { tax, ins };
}

/** Total monthly housing at a given price (tax/ins scale with price from the home you entered). */
function totalHousingAtPrice(
  price: number,
  d: MortgageConversationState["data"],
  tax: number,
  ins: number
): number | null {
  if (
    d.downPayment === null ||
    d.interestRatePct === null ||
    d.loanTermYears === null ||
    d.homePrice === null ||
    d.homePrice <= 0
  ) {
    return null;
  }
  const loan = Math.max(0, price - d.downPayment);
  const pi = monthlyPrincipalAndInterest(loan, d.interestRatePct, d.loanTermYears);
  const scale = price / d.homePrice;
  return pi + tax * scale + ins * scale + monthlyHoaAmount(d);
}

/** Max purchase price that keeps housing ≤ 35% of gross (same down, rate, term; tax/ins scale with price). */
function maxAffordableHomePrice(
  d: MortgageConversationState["data"],
  tax: number,
  ins: number
): number | null {
  if (
    d.grossMonthlyIncome === null ||
    d.downPayment === null ||
    d.interestRatePct === null ||
    d.loanTermYears === null ||
    d.homePrice === null ||
    d.homePrice <= 0
  ) {
    return null;
  }
  const cap = d.grossMonthlyIncome * (R.MAX_HOUSING_PCT_OF_GROSS_INCOME / 100);
  const minPrice = d.downPayment;
  const fits = (price: number) => {
    const total = totalHousingAtPrice(price, d, tax, ins);
    return total !== null && total <= cap;
  };
  if (!fits(minPrice)) return null;

  let lo = minPrice;
  let hi = Math.max(d.homePrice, minPrice + 500_000);
  let best = minPrice;
  for (let i = 0; i < 40 && lo <= hi; i++) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

function buildPurchaseAssessment(state: MortgageConversationState): FlowResult {
  const d = state.data;
  const downPct = downPaymentPct(d);
  const downOk = downPct !== null && downPct >= R.MIN_DOWN_PAYMENT_PCT;

  const closing =
    d.closingCosts ?? (d.homePrice !== null ? estimateClosingCosts(d.homePrice) : null);
  const requiredCash =
    d.downPayment !== null && closing !== null && d.emergencyFund !== null
      ? d.downPayment + closing + d.emergencyFund
      : null;
  const cashOk =
    requiredCash !== null && d.cashAvailable !== null && d.cashAvailable >= requiredCash;

  const termOk =
    d.loanTermYears !== null &&
    (R.PREFERRED_LOAN_TERMS_YEARS as readonly number[]).includes(d.loanTermYears);

  const loanAmount =
    d.homePrice !== null && d.downPayment !== null
      ? Math.max(0, d.homePrice - d.downPayment)
      : null;

  const pi =
    loanAmount !== null &&
    d.interestRatePct !== null &&
    d.loanTermYears !== null
      ? monthlyPrincipalAndInterest(loanAmount, d.interestRatePct, d.loanTermYears)
      : null;

  const { tax, ins } = resolveTaxAndInsurance(d, true);
  const hoa = monthlyHoaAmount(d);
  const totalHousing =
    pi !== null && tax !== null && ins !== null ? pi + tax + ins + hoa : null;
  const housingCap =
    d.grossMonthlyIncome !== null
      ? d.grossMonthlyIncome * (R.MAX_HOUSING_PCT_OF_GROSS_INCOME / 100)
      : null;
  const housingPct =
    totalHousing !== null && d.grossMonthlyIncome !== null && d.grossMonthlyIncome > 0
      ? (totalHousing / d.grossMonthlyIncome) * 100
      : null;
  const housingOk =
    housingPct !== null && housingPct <= R.MAX_HOUSING_PCT_OF_GROSS_INCOME;
  const maxPrice =
    tax !== null && ins !== null ? maxAffordableHomePrice(d, tax, ins) : null;

  const lines: string[] = [];
  lines.push("Mortgage assessment (home purchase):");
  lines.push("");

  if (d.homePrice !== null) {
    lines.push(`• Purchase price: $${d.homePrice.toLocaleString()}`);
  }
  if (d.grossMonthlyIncome !== null) {
    lines.push(`• Gross monthly income: $${d.grossMonthlyIncome.toLocaleString()}`);
  }
  if (d.downPayment !== null && downPct !== null) {
    lines.push(
      `• Down payment: $${d.downPayment.toLocaleString()} (${downPct.toFixed(1)}%, need ≥${R.MIN_DOWN_PAYMENT_PCT}%) → ${downOk ? "✓" : "✗"}`
    );
  }
  if (requiredCash !== null) {
    lines.push(
      `• Cash needed (down $${d.downPayment!.toLocaleString()} + closing $${closing!.toLocaleString()} + emergency fund $${d.emergencyFund!.toLocaleString()}): $${requiredCash.toLocaleString()}`
    );
    if (d.cashAvailable !== null) {
      lines.push(
        `• Cash you have: $${d.cashAvailable.toLocaleString()} → ${cashOk ? "✓ Ready on cash" : "✗ Not enough — keep renting"}`
      );
    }
  }
  if (d.loanTermYears !== null) {
    lines.push(
      `• Loan term: ${d.loanTermYears} years → ${termOk ? "✓ (15 or 30 only)" : "✗ Use 15 or 30 years"}`
    );
  }
  if (d.interestRatePct !== null) {
    lines.push(`• Interest rate: ${d.interestRatePct}%`);
    if (d.interestRatePct > R.HIGH_RATE_EXTRA_PAYOFF_PCT) {
      lines.push(`  → Above ${R.HIGH_RATE_EXTRA_PAYOFF_PCT}%: prioritize extra principal payments.`);
    }
  }
  if (housingCap !== null) {
    lines.push("");
    lines.push(`**Affordability (≤${R.MAX_HOUSING_PCT_OF_GROSS_INCOME}% of gross income):**`);
    lines.push(
      `• Max monthly housing budget: **$${Math.round(housingCap).toLocaleString()}/mo** (${R.MAX_HOUSING_PCT_OF_GROSS_INCOME}% of $${d.grossMonthlyIncome!.toLocaleString()} gross)`
    );
    if (maxPrice !== null) {
      const over =
        d.homePrice !== null && d.homePrice > maxPrice
          ? ` — your price is **$${(d.homePrice - maxPrice).toLocaleString()}** above this`
          : d.homePrice !== null && d.homePrice <= maxPrice
            ? " — your price fits"
            : "";
      lines.push(
        `• Estimated **max home price** at this down payment, rate, and term (tax/insurance scale with price): **$${maxPrice.toLocaleString()}**${over}`
      );
    }
  }

  if (totalHousing !== null && housingPct !== null) {
    lines.push("");
    lines.push("Monthly housing cost (your numbers):");
    if (pi !== null) lines.push(`  • Principal & interest: $${Math.round(pi).toLocaleString()}`);
    if (tax !== null) {
      lines.push(
        `  • Property tax: $${Math.round(tax).toLocaleString()}${d.monthlyPropertyTax === null ? " (estimated)" : ""}`
      );
    }
    if (ins !== null) {
      lines.push(
        `  • Insurance: $${Math.round(ins).toLocaleString()}${d.monthlyInsurance === null ? " (estimated)" : ""}`
      );
    }
    if (hoa > 0) {
      lines.push(`  • HOA / maintenance: $${Math.round(hoa).toLocaleString()}`);
    }
    lines.push(
      `  • **Total: $${Math.round(totalHousing).toLocaleString()}/mo** = ${housingPct.toFixed(1)}% of gross income (max ${R.MAX_HOUSING_PCT_OF_GROSS_INCOME}%) → ${housingOk ? "✓ Pass" : "✗ Too high — do not recommend buying"}`
    );
    if (!housingOk && housingCap !== null && totalHousing > housingCap) {
      lines.push(
        `  → You are **$${Math.round(totalHousing - housingCap).toLocaleString()}/mo** over the ${R.MAX_HOUSING_PCT_OF_GROSS_INCOME}% cap.`
      );
    }
  }

  lines.push("");
  const ready = downOk && cashOk && termOk && housingOk;
  if (ready) {
    lines.push(
      "Overall: You meet our mortgage guidelines (cash readiness, 15/30-year term, and housing ≤35% of gross income). Buying may be reasonable under these rules."
    );
  } else {
    lines.push("Overall: We do **not** recommend buying yet under these rules:");
    if (!downOk) lines.push(`• Need at least ${R.MIN_DOWN_PAYMENT_PCT}% down.`);
    if (!cashOk) {
      lines.push(
        "• Need enough cash for down payment + closing costs + emergency fund (not borrowed)."
      );
    }
    if (!termOk) lines.push("• Use a 15- or 30-year mortgage only.");
    if (!housingOk) {
      lines.push(
        `• Housing cost must be ≤${R.MAX_HOUSING_PCT_OF_GROSS_INCOME}% of gross income — lower the price, increase income, put more down, or keep renting.`
      );
    }
  }

  return { answer: lines.join("\n"), state: { ...state, stage: null } };
}

function buildRefiAssessment(state: MortgageConversationState): FlowResult {
  const d = state.data;
  const cur = d.currentRatePct;
  const neu = d.newRatePct;
  const gap = cur !== null && neu !== null ? cur - neu : null;
  const refiOk = gap !== null && gap >= R.REFINANCE_RATE_DROP_MIN_PCT;
  const termOk =
    d.loanTermYears !== null &&
    (R.PREFERRED_LOAN_TERMS_YEARS as readonly number[]).includes(d.loanTermYears);

  const lines: string[] = [];
  lines.push("Mortgage refinance checklist:");
  lines.push("");
  lines.push(
    `Refinance when the new rate is at least ${R.REFINANCE_RATE_DROP_MIN_PCT} percentage point lower (e.g. 7% → 6%).`
  );
  lines.push("");
  if (cur !== null) lines.push(`• Current rate: ${cur}%`);
  if (neu !== null) lines.push(`• New rate: ${neu}%`);
  if (gap !== null) {
    lines.push(
      `• Difference: ${gap.toFixed(2)} pts → ${refiOk ? "✓ Refinance fits our rule" : "✗ Wait for a ≥1 pt drop"}`
    );
  }
  if (d.loanTermYears !== null) {
    lines.push(
      `• Term: ${d.loanTermYears} years → ${termOk ? "✓" : "✗ Use 15 or 30 years only"}`
    );
  }
  lines.push("");
  lines.push(
    refiOk && termOk
      ? "Overall: Refinancing fits our guidelines (confirm closing costs)."
      : !refiOk
        ? "Overall: Do not refinance yet — rate improvement is under 1 point."
        : "Overall: Fix loan term to 15 or 30 years before refinancing."
  );

  return { answer: lines.join("\n"), state: { ...state, stage: null } };
}

function contextualPrompt(
  state: MortgageConversationState,
  answer: string,
  stage: MortgageStage
): FlowResult {
  return { answer, state: { ...state, stage } };
}

function mortgageContextSummary(d: MortgageConversationState["data"]): string[] {
  const parts: string[] = [];
  if (d.homePrice !== null) parts.push(`**$${d.homePrice.toLocaleString()}** home`);
  if (d.grossMonthlyIncome !== null) {
    parts.push(`**$${d.grossMonthlyIncome.toLocaleString()}/mo** income`);
  }
  if (d.downPayment !== null) parts.push(`**$${d.downPayment.toLocaleString()}** down`);
  if (d.interestRatePct !== null) parts.push(`**${d.interestRatePct}%** rate`);
  if (d.loanTermYears !== null) parts.push(`**${d.loanTermYears}-year** term`);
  return parts;
}

function nextMortgageQuestion(state: MortgageConversationState): FlowResult {
  const d = state.data;
  const summary = mortgageContextSummary(d);
  const ack =
    summary.length >= 3
      ? intakeAcknowledgment(summary)
      : summary.length === 2
        ? `Got it — ${summary.join(", ")}.\n\n`
        : "";

  if (d.isRefinance === null) {
    if (d.homePrice !== null) {
      state.data.isRefinance = false;
    } else {
      return contextualPrompt(
        state,
        "Are you **buying a home** or **refinancing**? (If you share a purchase price, I’ll assume you’re buying.)",
        "scenario"
      );
    }
  }

  if (d.isRefinance) {
    if (d.currentRatePct === null) {
      return contextualPrompt(
        state,
        "What is your **current mortgage rate**? (e.g. 6.5%)",
        "current_rate"
      );
    }
    if (d.newRatePct === null) {
      return contextualPrompt(
        state,
        `What **new rate** are you offered? (We refinance at ≥${R.REFINANCE_RATE_DROP_MIN_PCT}% lower.)`,
        "new_rate"
      );
    }
    if (d.loanTermYears === null) {
      return contextualPrompt(state, "New loan term — **15 or 30 years**?", "loan_term");
    }
    return buildRefiAssessment(state);
  }

  // Purchase — friendly order
  if (d.homePrice === null) {
    return contextualPrompt(
      state,
      "What is the **home purchase price**? (e.g. $500,000 or 500k)",
      "home_price"
    );
  }

  if (d.grossMonthlyIncome === null) {
    return contextualPrompt(
      state,
      `${ack}What is your **gross monthly income** (before taxes)?`,
      "gross_income"
    );
  }

  if (d.downPayment === null) {
    const need = Math.ceil(d.homePrice! * (R.MIN_DOWN_PAYMENT_PCT / 100));
    return contextualPrompt(
      state,
      `${ack}How much will you put **down**? (Minimum ${R.MIN_DOWN_PAYMENT_PCT}% = about $${need.toLocaleString()} on this home)`,
      "down_payment"
    );
  }

  if (d.emergencyFund === null) {
    return contextualPrompt(
      state,
      "How much will you keep in an **emergency fund** after closing? (Separate from the down payment — must stay funded.)",
      "emergency_fund"
    );
  }

  if (d.closingCosts === null) {
    const est = estimateClosingCosts(d.homePrice!);
    return contextualPrompt(
      state,
      `Estimated **closing costs**? (If unsure, many buyers use ~${R.ESTIMATED_CLOSING_COST_PCT}% of price ≈ $${est.toLocaleString()}.)`,
      "closing_costs"
    );
  }

  if (d.cashAvailable === null) {
    const need = requiredCashTotal(d);
    return contextualPrompt(
      state,
      `Do you have enough **cash on hand** for down payment + closing + emergency fund combined? (Need about **$${need!.toLocaleString()}** total — not borrowed.)\n\nReply **yes** if you have that much, **no** if not, or type the dollar amount you have.`,
      "cash_available"
    );
  }

  if (d.interestRatePct === null) {
    return contextualPrompt(
      state,
      "What **mortgage interest rate** do you expect? (e.g. 6.25%)",
      "interest_rate"
    );
  }

  if (d.loanTermYears === null) {
    return contextualPrompt(
      state,
      "Loan term — **15 or 30 years**? (Only these two fit our rules.)",
      "loan_term"
    );
  }

  if (d.monthlyPropertyTax === null) {
    return contextualPrompt(
      state,
      "What are your **monthly property taxes** for this home? (Required — or say “estimate” for a rough default.)",
      "property_tax"
    );
  }

  if (d.monthlyInsurance === null) {
    return contextualPrompt(
      state,
      "What is your **monthly homeowners insurance**? (Required — or say “estimate”.)",
      "insurance"
    );
  }

  if (d.monthlyHoaMaintenance === null) {
    return contextualPrompt(
      state,
      "Monthly **HOA or maintenance** (optional — enter **0** or **none** if you don’t have any):",
      "hoa_maintenance"
    );
  }

  return buildPurchaseAssessment(state);
}

function applyInferredMortgageAnswer(
  state: MortgageConversationState,
  userText: string
): void {
  state.data = mergeKnown(state.data, extractMortgageSignals(userText));

  const need = requiredCashTotal(state.data);
  const yn = parseYesNo(userText);
  if (yn === true && need !== null) {
    state.data.cashAvailable = need;
    return;
  }
  if (yn === false && state.data.cashAvailable === null) {
    state.data.cashAvailable = 0;
    return;
  }

  const rate = parseAprPercent(userText);
  if (rate !== null) {
    state.data.interestRatePct = rate;
    return;
  }

  if (state.stage === "gross_income" || state.data.grossMonthlyIncome === null) {
    const inc = parseGrossMonthlyIncome(userText) ?? parseIncomeShortReply(userText);
    if (inc !== null) {
      state.data.grossMonthlyIncome = inc;
      return;
    }
  }

  if (/\b15\b/.test(userText) && !/\b30\b/.test(userText)) {
    state.data.loanTermYears = 15;
    return;
  }
  if (/\b30\b/.test(userText)) {
    state.data.loanTermYears = 30;
    return;
  }

  if (state.stage) {
    applyStageAnswer(state, userText);
  }
}

function applyStageAnswer(state: MortgageConversationState, userText: string): void {
  const t = userText.trim().toLowerCase();
  const amt =
    parseAmountToken(userText) ?? firstAmount(userText, /([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)/i);
  const pct = parsePercent(userText, /(\d+(?:\.\d+)?)\s*%/);

  if (/estimate/i.test(t)) {
    if (state.stage === "property_tax" && state.data.homePrice) {
      state.data.monthlyPropertyTax = estimateMonthlyTax(state.data.homePrice);
    }
    if (state.stage === "insurance" && state.data.homePrice) {
      state.data.monthlyInsurance = estimateMonthlyInsurance(state.data.homePrice);
    }
    if (state.stage === "hoa_maintenance") {
      state.data.monthlyHoaMaintenance = 0;
    }
  }

  if (state.stage === "hoa_maintenance" && /^(none|no|n\/a|0|zero|skip)$/i.test(t)) {
    state.data.monthlyHoaMaintenance = 0;
  }

  switch (state.stage) {
    case "scenario":
      if (/refinanc|refi/.test(t)) state.data.isRefinance = true;
      else if (/buy|purchase|home/.test(t)) state.data.isRefinance = false;
      break;
    case "home_price":
      if (amt !== null) state.data.homePrice = amt;
      break;
    case "gross_income":
      if (amt !== null) state.data.grossMonthlyIncome = amt;
      break;
    case "down_payment":
      if (amt !== null) state.data.downPayment = amt;
      break;
    case "closing_costs":
      if (amt !== null) state.data.closingCosts = amt;
      break;
    case "emergency_fund":
      if (amt !== null) state.data.emergencyFund = amt;
      break;
    case "cash_available": {
      const need = requiredCashTotal(state.data);
      const yn = parseYesNo(userText);
      if (yn === true && need !== null) {
        state.data.cashAvailable = need;
      } else if (yn === false) {
        state.data.cashAvailable = 0;
      } else if (amt !== null) {
        state.data.cashAvailable = amt;
      }
      break;
    }
    case "loan_term":
      if (/\b15\b/.test(t)) state.data.loanTermYears = 15;
      else if (/\b30\b/.test(t)) state.data.loanTermYears = 30;
      break;
    case "interest_rate":
      if (pct !== null) state.data.interestRatePct = pct;
      else if (amt !== null && amt < 20) state.data.interestRatePct = amt;
      break;
    case "property_tax":
      if (amt !== null) state.data.monthlyPropertyTax = amt;
      break;
    case "insurance":
      if (amt !== null) state.data.monthlyInsurance = amt;
      break;
    case "hoa_maintenance":
      if (/^(none|no|n\/a|skip)$/i.test(t)) state.data.monthlyHoaMaintenance = 0;
      else if (amt !== null && amt >= 0) state.data.monthlyHoaMaintenance = amt;
      break;
    case "current_rate":
      if (pct !== null) state.data.currentRatePct = pct;
      break;
    case "new_rate":
      if (pct !== null) state.data.newRatePct = pct;
      break;
    default:
      break;
  }
}

export function handleMortgageFlow(
  thread: Msg[],
  incomingState?: MortgageConversationState | null,
  options?: { forceTopic?: boolean }
): FlowResult | null {
  const allUserText = thread
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");

  const state = initMortgageState(incomingState);
  const last = thread[thread.length - 1];

  if (incomingState?.intakeComplete) {
    return null;
  }

  let correctionNote: string | null = null;
  if (last?.role === "user" && looksLikeDataCorrection(last.content)) {
    const { changed, note } = applyMortgageCorrections(state.data, last.content);
    correctionNote = note ?? "Recalculating with your updated numbers.";
    state.addressedConcerns = [];
    state.lastConcernShown = undefined;
    state.stage = null;
  } else {
    syncMortgageSignalsFromThread(state, thread);
  }

  if (options?.forceTopic && state.data.isRefinance === null && state.data.homePrice !== null) {
    state.data.isRefinance = false;
  }

  if (last?.role === "user" && !looksLikeDataCorrection(last.content)) {
    const bulk = /,/.test(last.content) && mortgageContextSummary(state.data).length >= 2;
    if (!bulk && !parseYesNo(last.content)) {
      const direct = tryDirectSectionAnswer(last.content, "mortgage");
      if (direct) {
        return {
          answer: direct.answer,
          state: { ...state, stage: state.stage, data: state.data },
        };
      }
    }

    applyInferredMortgageAnswer(state, last.content);
    if (!looksLikeDataCorrection(last.content)) {
      syncMortgageSignalsFromThread(state, thread);
    }
  }

  if (correctionNote && last?.role === "user") {
    if (state.data.isRefinance) {
      const refi = buildRefiAssessment(state);
      return {
        answer: `${correctionNote}\n\n${refi.answer}`,
        state: refi.state,
      };
    }
    const assessment = buildPurchaseAssessment(state);
    return {
      answer: `${correctionNote}\n\n${assessment.answer}`,
      state: assessment.state,
    };
  }

  if (!options?.forceTopic) {
    const hasAny = isMortgageFlowActive(state);
    if (!hasAny && !/(mortgage|home\s+loan|refinanc|buy(?:ing)?\s+a\s+home)/i.test(allUserText))
      return null;
  }

  const mortgageHelpers = {
    estimatePi: monthlyPrincipalAndInterest,
    estimateTax: estimateMonthlyTax,
    estimateIns: estimateMonthlyInsurance,
    hiddenPct: R.HIDDEN_COST_PCT_DEFAULT,
    requiredCash: requiredCashTotal,
  };

  let conversational = autoResolveMortgageConcerns(state, {
    requiredCash: requiredCashTotal,
  });
  if (last?.role === "user") {
    conversational = acknowledgeLastConcern(conversational, last.content);
    const picked = pickMortgageConcern(conversational, last.content, mortgageHelpers);
    if (picked) {
      return {
        answer: picked.concern.message,
        state: picked.state,
      };
    }
  }

  const result = nextMortgageQuestion(conversational);
  if (
    last?.role === "user" &&
    parseYesNo(last.content) === true &&
    state.data.cashAvailable !== null &&
    result.state.stage === "interest_rate"
  ) {
    return {
      answer:
        `Good — you have enough cash for down payment, closing, and emergency fund ($${state.data.cashAvailable.toLocaleString()} needed).\n\n` +
        result.answer,
      state: result.state,
    };
  }

  return result;
}
