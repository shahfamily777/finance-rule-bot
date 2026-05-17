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
  stage: MortgageStage;
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

  out.homePrice =
    firstAmount(
      text,
      /([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)\s*(?:purchase\s*price|home\s*price|house\s*price|asking\s*price)/i
    ) ??
    firstAmount(
      text,
      /(?:purchase\s*price|home\s*price|house\s*price|price)\s*(?:is\s+|of\s+)?\$?\s*([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)/i
    ) ??
    (/(?:purchase\s*price|home\s*price|house\s*price|\d+\s*k\b)/i.test(text)
      ? parseFirstMoneyAmount(text)
      : null);

  out.grossMonthlyIncome =
    firstAmount(
      text,
      /(?:(?:gross\s+)?(?:monthly\s+)?income|make\s+per\s+month|earn)\s*(?:is\s+)?\$?\s*([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)/i
    ) ?? null;

  const downPct = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:down|downpayment)/i);
  if (downPct && out.homePrice) {
    out.downPayment = (out.homePrice * Number(downPct[1])) / 100;
  }
  if (out.downPayment == null) {
    out.downPayment =
      firstAmount(text, /(?:down\s*payment|putting\s+down)\s*\$?\s*([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)/i) ??
      null;
  }

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

  out.interestRatePct =
    parsePercent(text, /(?:interest\s*rate|mortgage\s*rate|rate)\s*(?:of\s+|at\s+|is\s+)?(\d+(?:\.\d+)?)\s*%/i) ??
    parsePercent(text, /(\d+(?:\.\d+)?)\s*%\s*(?:interest|apr|fixed)/i) ??
    null;

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

function monthlyPrincipalAndInterest(
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

  const tax =
    d.monthlyPropertyTax ??
    (d.homePrice !== null ? estimateMonthlyTax(d.homePrice) : null);
  const ins =
    d.monthlyInsurance ??
    (d.homePrice !== null ? estimateMonthlyInsurance(d.homePrice) : null);

  const piti = pi !== null && tax !== null && ins !== null ? pi + tax + ins : null;
  const hidden =
    d.monthlyHoaMaintenance !== null && d.monthlyHoaMaintenance > 0
      ? d.monthlyHoaMaintenance
      : piti !== null
        ? Math.round(piti * (R.HIDDEN_COST_PCT_DEFAULT / 100))
        : null;
  const totalHousing = piti !== null && hidden !== null ? piti + hidden : null;
  const housingPct =
    totalHousing !== null && d.grossMonthlyIncome !== null && d.grossMonthlyIncome > 0
      ? (totalHousing / d.grossMonthlyIncome) * 100
      : null;
  const housingOk =
    housingPct !== null && housingPct <= R.MAX_HOUSING_PCT_OF_GROSS_INCOME;

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
  if (totalHousing !== null && housingPct !== null) {
    lines.push("");
    lines.push("Monthly housing cost (estimated):");
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
    if (hidden !== null) {
      lines.push(
        `  • HOA / maintenance / hidden (~${R.HIDDEN_COST_PCT_DEFAULT}% of PITI): $${Math.round(hidden).toLocaleString()}${d.monthlyHoaMaintenance === null ? " (estimated)" : ""}`
      );
    }
    lines.push(
      `  • **Total: $${Math.round(totalHousing).toLocaleString()}/mo** = ${housingPct.toFixed(1)}% of gross income (max ${R.MAX_HOUSING_PCT_OF_GROSS_INCOME}%) → ${housingOk ? "✓ Pass" : "✗ Too high — do not recommend buying"}`
    );
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

function nextMortgageQuestion(state: MortgageConversationState): FlowResult {
  const d = state.data;

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
    const priceNote = `Got it — **$${d.homePrice.toLocaleString()}** purchase price.\n\n`;
    return contextualPrompt(
      state,
      `${priceNote}What is your **gross monthly income** (before taxes)?`,
      "gross_income"
    );
  }

  if (d.downPayment === null) {
    const need = Math.ceil(d.homePrice! * (R.MIN_DOWN_PAYMENT_PCT / 100));
    return contextualPrompt(
      state,
      `How much will you put **down**? (Minimum ${R.MIN_DOWN_PAYMENT_PCT}% = about $${need.toLocaleString()} on this home)`,
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
    const need =
      d.downPayment! + (d.closingCosts ?? estimateClosingCosts(d.homePrice!)) + d.emergencyFund!;
    return contextualPrompt(
      state,
      `Do you have enough **cash on hand** for down payment + closing + emergency fund combined? (Need about $${need.toLocaleString()} total — not borrowed.)`,
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
      "What are **monthly property taxes**? (Or say “estimate” and I’ll use a rough default.)",
      "property_tax"
    );
  }

  if (d.monthlyInsurance === null) {
    return contextualPrompt(
      state,
      "What is **monthly homeowners insurance**? (Or say “estimate”.)",
      "insurance"
    );
  }

  if (d.monthlyHoaMaintenance === null) {
    return contextualPrompt(
      state,
      `Monthly **HOA + maintenance/repairs**? (Or say “estimate” — we use ~${R.HIDDEN_COST_PCT_DEFAULT}% of mortgage+tax+insurance for hidden costs.)`,
      "hoa_maintenance"
    );
  }

  return buildPurchaseAssessment(state);
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
    case "cash_available":
      if (amt !== null) state.data.cashAvailable = amt;
      break;
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
      if (amt !== null && amt >= 0) state.data.monthlyHoaMaintenance = amt;
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
  if (last?.role === "user") {
    const direct = tryDirectSectionAnswer(last.content, "mortgage");
    if (direct) {
      return { answer: direct.answer, state: { ...state, stage: null } };
    }
  }

  state.data = mergeKnown(state.data, extractMortgageSignals(allUserText));

  if (options?.forceTopic && state.data.isRefinance === null && state.data.homePrice !== null) {
    state.data.isRefinance = false;
  }

  if (last?.role === "user" && state.stage) {
    applyStageAnswer(state, last.content);
    state.data = mergeKnown(state.data, extractMortgageSignals(last.content));
  }

  if (!options?.forceTopic) {
    const hasAny = isMortgageFlowActive(state);
    if (!hasAny && !/(mortgage|home\s+loan|refinanc|buy(?:ing)?\s+a\s+home)/i.test(allUserText))
      return null;
  }

  return nextMortgageQuestion(state);
}
