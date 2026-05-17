// Deterministic car-loan eligibility flow (20% down, ≤48 months, ≤10% transport).

import { tryDirectSectionAnswer } from "@/lib/section-qa";

export type Msg = { role: "user" | "assistant"; content: string };

const MIN_DOWN_PCT = 20;
const MAX_TERM_MONTHS = 48;
const MAX_TRANSPORT_PCT = 10;

export type CarLoanStage =
  | "vehicle_price"
  | "down_payment"
  | "loan_term"
  | "gross_income"
  | "car_payment"
  | "insurance"
  | "fuel"
  | "maintenance"
  | null;

export type CarLoanConversationState = {
  stage: CarLoanStage;
  data: {
    vehiclePrice: number | null;
    downPayment: number | null;
    loanTermMonths: number | null;
    grossMonthlyIncome: number | null;
    monthlyCarPayment: number | null;
    monthlyInsurance: number | null;
    monthlyFuel: number | null;
    monthlyMaintenance: number | null;
    /** Set when user gives one combined transport figure */
    monthlyTransportTotal: number | null;
  };
};

type CarLoanPartial = Partial<CarLoanConversationState["data"]>;

type FlowResult = { answer: string; state: CarLoanConversationState };

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

function extractDownPaymentFromPercent(text: string, vehiclePrice: number | null): number | null {
  const m = text.match(
    /(?:have|got|with|i\s+have)\s+(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*%\s*(?:down|to\s+put\s+down)?/i
  );
  if (!m || vehiclePrice === null) return null;
  const pct = Number(m[1] || m[2]);
  if (!Number.isFinite(pct) || pct < 5 || pct > 100) return null;
  return (vehiclePrice * pct) / 100;
}

function extractCarLoanSignals(text: string): CarLoanPartial {
  const out: CarLoanPartial = {};

  out.vehiclePrice =
    firstAmount(
      text,
      /([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)\s*(?:car|vehicle|auto)\s*price/i
    ) ??
    firstAmount(
      text,
      /(?:car|vehicle|auto)\s*price\s*(?:is\s+|of\s+)?\$?\s*([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)/i
    ) ??
    firstAmount(
      text,
      /(?:purchase\s*price|vehicle\s*price|car\s*(?:costs?|price|is)|buy(?:ing)?\s+(?:a\s+)?)\s*\$?\s*([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)/i
    ) ??
    firstAmount(text, /\$\s*([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)\s*(?:car|vehicle|suv|truck)/i) ??
    (/(?:car|vehicle|auto)\s*price|\bcar\s*price/i.test(text)
      ? parseFirstMoneyAmount(text)
      : null);

  const downPct = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:down|downpayment)/i);
  if (downPct && out.vehiclePrice) {
    out.downPayment = (out.vehiclePrice * Number(downPct[1])) / 100;
  }
  if (out.downPayment == null) {
    out.downPayment =
      firstAmount(text, /(?:down\s*payment|putting\s+down|down\s+of)\s*\$?\s*([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)/i) ??
      null;
  }
  if (out.downPayment == null && out.vehiclePrice) {
    out.downPayment = extractDownPaymentFromPercent(text, out.vehiclePrice);
  }

  const termMonths = text.match(/(\d+)\s*-?\s*month/i);
  if (termMonths) {
    const n = Number(termMonths[1]);
    if (Number.isFinite(n)) out.loanTermMonths = n;
  }
  const termYears = text.match(/(\d+(?:\.\d+)?)\s*-?\s*year/i);
  if (termYears && out.loanTermMonths === undefined) {
    const y = Number(termYears[1]);
    if (Number.isFinite(y)) out.loanTermMonths = Math.round(y * 12);
  }
  if (/\b48\s*month|\b4\s*year\b/i.test(text) && out.loanTermMonths == null) {
    out.loanTermMonths = 48;
  }

  out.grossMonthlyIncome =
    firstAmount(
      text,
      /(?:(?:gross\s+)?(?:monthly\s+)?income|make\s+per\s+month|earn(?:ing)?)\s*(?:of\s+)?\$?\s*([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)/i
    ) ?? null;

  out.monthlyCarPayment =
    firstAmount(
      text,
      /(?:car\s+)?(?:payment|note|loan\s+payment)\s*(?:of\s+)?\$?\s*([\d,]+(?:\.\d+)?)/i
    ) ?? null;

  out.monthlyInsurance =
    firstAmount(text, /(?:auto\s+)?insurance\s*(?:of\s+)?\$?\s*([\d,]+(?:\.\d+)?)/i) ?? null;

  out.monthlyFuel =
    firstAmount(text, /(?:fuel|gas|gasoline)\s*(?:of\s+)?\$?\s*([\d,]+(?:\.\d+)?)/i) ?? null;

  out.monthlyMaintenance =
    firstAmount(
      text,
      /(?:maintenance|repairs?|service)\s*(?:of\s+)?\$?\s*([\d,]+(?:\.\d+)?)/i
    ) ?? null;

  out.monthlyTransportTotal =
    firstAmount(
      text,
      /(?:transportation|transport)\s*(?:costs?|expenses?|budget)?\s*(?:of\s+)?\$?\s*([\d,]+(?:\.\d+)?)/i
    ) ?? null;

  return out;
}

function mergeKnown(
  base: CarLoanConversationState["data"],
  next: CarLoanPartial
): CarLoanConversationState["data"] {
  const merged = { ...base };
  for (const [k, v] of Object.entries(next)) {
    const key = k as keyof CarLoanConversationState["data"];
    if (v === undefined || v === null) continue;
    if (merged[key] === null) merged[key] = v as never;
  }
  return merged;
}

function initCarLoanState(
  incoming?: CarLoanConversationState | null
): CarLoanConversationState {
  if (incoming && typeof incoming === "object" && incoming.data) return incoming;
  return {
    stage: null,
    data: {
      vehiclePrice: null,
      downPayment: null,
      loanTermMonths: null,
      grossMonthlyIncome: null,
      monthlyCarPayment: null,
      monthlyInsurance: null,
      monthlyFuel: null,
      monthlyMaintenance: null,
      monthlyTransportTotal: null,
    },
  };
}

function transportMonthly(d: CarLoanConversationState["data"]): number | null {
  if (d.monthlyTransportTotal !== null) return d.monthlyTransportTotal;
  const parts = [
    d.monthlyCarPayment,
    d.monthlyInsurance,
    d.monthlyFuel,
    d.monthlyMaintenance,
  ];
  if (parts.every((p) => p !== null)) {
    return parts.reduce((a, b) => a + (b ?? 0), 0);
  }
  return null;
}

function downPaymentPct(d: CarLoanConversationState["data"]): number | null {
  if (d.vehiclePrice === null || d.downPayment === null || d.vehiclePrice <= 0) return null;
  return (d.downPayment / d.vehiclePrice) * 100;
}

function buildAssessment(state: CarLoanConversationState): FlowResult {
  const d = state.data;
  const downPct = downPaymentPct(d);
  const transport = transportMonthly(d);
  const transportPct =
    transport !== null && d.grossMonthlyIncome !== null && d.grossMonthlyIncome > 0
      ? (transport / d.grossMonthlyIncome) * 100
      : null;

  const downOk = downPct !== null && downPct >= MIN_DOWN_PCT;
  const termOk = d.loanTermMonths !== null && d.loanTermMonths <= MAX_TERM_MONTHS;
  const transportOk =
    transportPct !== null && transportPct <= MAX_TRANSPORT_PCT;

  const lines: string[] = [];
  lines.push("Car loan checklist (your numbers):");
  lines.push("");

  if (d.vehiclePrice !== null) {
    lines.push(`• Vehicle price: $${d.vehiclePrice.toLocaleString()}`);
  }
  if (d.downPayment !== null && downPct !== null) {
    lines.push(
      `• Down payment: $${d.downPayment.toLocaleString()} (${downPct.toFixed(1)}% — need ≥${MIN_DOWN_PCT}%) → ${downOk ? "✓ Pass" : "✗ Below target"}`
    );
  }
  if (d.loanTermMonths !== null) {
    lines.push(
      `• Loan term: ${d.loanTermMonths} months (hard max ${MAX_TERM_MONTHS} / 4 years — no exceptions) → ${
        termOk
          ? "✓ Pass"
          : "✗ Not allowed — we do not approve or advise loans longer than 48 months under any parameters"
      }`
    );
  }
  if (transport !== null && transportPct !== null) {
    lines.push(
      `• Monthly transportation: $${transport.toLocaleString()} (${transportPct.toFixed(1)}% of gross income — cap ${MAX_TRANSPORT_PCT}%) → ${transportOk ? "✓ Pass" : "✗ Over cap"}`
    );
    if (d.monthlyTransportTotal === null) {
      lines.push(
        `  (payment $${(d.monthlyCarPayment ?? 0).toLocaleString()} + insurance $${(d.monthlyInsurance ?? 0).toLocaleString()} + fuel $${(d.monthlyFuel ?? 0).toLocaleString()} + maintenance $${(d.monthlyMaintenance ?? 0).toLocaleString()})`
      );
    }
  }

  lines.push("");
  lines.push(
    "Note: These three rules are fixed for this app — especially the 48-month maximum. There is no compromise or exception path."
  );
  lines.push("");

  if (downOk && termOk && transportOk) {
    lines.push(
      "Overall: You meet all three fixed rules (20% down, ≤48-month term, ≤10% transportation). This structure fits our car-loan guidelines."
    );
  } else {
    lines.push("Overall: You do not meet one or more fixed rules. Adjust before financing:");
    if (!downOk) {
      const need =
        d.vehiclePrice !== null
          ? Math.ceil(d.vehiclePrice * (MIN_DOWN_PCT / 100))
          : null;
      lines.push(
        need !== null
          ? `• Put at least $${need.toLocaleString()} down (20%) to avoid being upside-down on depreciation.`
          : `• Put at least ${MIN_DOWN_PCT}% down on the purchase price.`
      );
    }
    if (!termOk) {
      lines.push(
        `• Loan term must be ${MAX_TERM_MONTHS} months (4 years) or shorter — not negotiable. Do not use 60- or 72-month loans. Choose a cheaper car, put more down, or wait; do not extend the term.`
      );
    }
    if (!transportOk) {
      lines.push(
        `• Lower total transportation (payment + insurance + fuel + maintenance) to ≤${MAX_TRANSPORT_PCT}% of gross monthly income, or increase income / choose a cheaper car.`
      );
    }
  }

  return { answer: lines.join("\n"), state: { ...state, stage: null } };
}

function nextCarLoanQuestion(state: CarLoanConversationState): FlowResult {
  const d = state.data;

  if (d.vehiclePrice === null) {
    return {
      answer:
        "What is the vehicle purchase price? (e.g. $32,000)",
      state: { ...state, stage: "vehicle_price" },
    };
  }
  if (d.downPayment === null) {
    return {
      answer: `How much will you put down? (Target: at least ${MIN_DOWN_PCT}% = $${Math.ceil(d.vehiclePrice * (MIN_DOWN_PCT / 100)).toLocaleString()} on this price)`,
      state: { ...state, stage: "down_payment" },
    };
  }
  if (d.loanTermMonths === null) {
    return {
      answer:
        "What loan term in months? Hard rule: maximum 48 months (4 years). We do not allow or advise longer terms — no exceptions.",
      state: { ...state, stage: "loan_term" },
    };
  }
  if (d.grossMonthlyIncome === null) {
    const downPct = downPaymentPct(d);
    let intro = "";
    if (d.vehiclePrice !== null && d.downPayment !== null && downPct !== null) {
      intro =
        `Got it — **$${d.vehiclePrice.toLocaleString()}** car, **$${d.downPayment.toLocaleString()}** down (${downPct.toFixed(0)}%). ` +
        `Your down payment ${downPct >= MIN_DOWN_PCT ? "meets" : "is below"} our **${MIN_DOWN_PCT}%** minimum. `;
    } else if (d.vehiclePrice !== null) {
      intro = `Got it — **$${d.vehiclePrice.toLocaleString()}** vehicle price. `;
    }
    return {
      answer:
        `${intro}To check if you can buy under our **20 / 48 / 10** rules (20% down, max **48-month** loan, total transport ≤**10%** of income), what is your **gross monthly income** (before taxes)?`,
      state: { ...state, stage: "gross_income" },
    };
  }

  const transport = transportMonthly(d);
  if (transport === null) {
    if (d.monthlyTransportTotal === null && d.monthlyCarPayment === null) {
      return {
        answer:
          "What is your expected monthly car payment (loan note)?",
        state: { ...state, stage: "car_payment" },
      };
    }
    if (d.monthlyInsurance === null) {
      return {
        answer: "What is your expected monthly auto insurance?",
        state: { ...state, stage: "insurance" },
      };
    }
    if (d.monthlyFuel === null) {
      return {
        answer: "About how much per month for **fuel / gas**?",
        state: { ...state, stage: "fuel" },
      };
    }
    if (d.monthlyMaintenance === null) {
      return {
        answer:
          "About how much per month for maintenance/repairs? (Or say your total monthly transportation cost in one number.)",
        state: { ...state, stage: "maintenance" },
      };
    }
  }

  return buildAssessment(state);
}

function applyStageAnswer(
  state: CarLoanConversationState,
  userText: string
): void {
  const amt = parseAmountToken(userText) ?? firstAmount(userText, /([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)/i);
  const termM = userText.match(/(\d+)\s*-?\s*month/i);
  const termY = userText.match(/(\d+(?:\.\d+)?)\s*-?\s*year/i);

  switch (state.stage) {
    case "vehicle_price":
      if (amt !== null) state.data.vehiclePrice = amt;
      break;
    case "down_payment":
      if (amt !== null) state.data.downPayment = amt;
      break;
    case "loan_term":
      if (termM) state.data.loanTermMonths = Number(termM[1]);
      else if (termY) state.data.loanTermMonths = Math.round(Number(termY[1]) * 12);
      else if (amt !== null && amt <= 10) state.data.loanTermMonths = Math.round(amt * 12);
      else if (amt !== null) state.data.loanTermMonths = amt;
      break;
    case "gross_income":
      if (amt !== null) state.data.grossMonthlyIncome = amt;
      break;
    case "car_payment":
      if (amt !== null) state.data.monthlyCarPayment = amt;
      break;
    case "insurance":
      if (amt !== null) state.data.monthlyInsurance = amt;
      break;
    case "fuel":
      if (amt !== null) state.data.monthlyFuel = amt;
      break;
    case "maintenance":
      if (amt !== null) {
        if (/transport/i.test(userText)) state.data.monthlyTransportTotal = amt;
        else state.data.monthlyMaintenance = amt;
      }
      break;
    default:
      break;
  }
}

export function isCarLoanFlowActive(
  state: CarLoanConversationState | null | undefined
): boolean {
  if (!state?.data) return Boolean(state?.stage);
  const d = state.data;
  return (
    state.stage !== null ||
    d.vehiclePrice !== null ||
    d.downPayment !== null ||
    d.loanTermMonths !== null ||
    d.grossMonthlyIncome !== null ||
    d.monthlyCarPayment !== null ||
    d.monthlyTransportTotal !== null
  );
}

function mentionsCarLoan(text: string): boolean {
  return /(car\s+loan|auto\s+loan|vehicle\s+loan|financ(e|ing)\s+a\s+car|buy(?:ing)?\s+a\s+car|new\s+car|used\s+car)/i.test(
    text
  );
}

/** Run car-loan guided flow when topic is car-loan or user is clearly discussing auto financing. */
export function handleCarLoanFlow(
  thread: Msg[],
  incomingState?: CarLoanConversationState | null,
  options?: { forceTopic?: boolean }
): FlowResult | null {
  const allUserText = thread
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");

  if (!options?.forceTopic && !mentionsCarLoan(allUserText)) return null;

  const state = initCarLoanState(incomingState);

  const last = thread[thread.length - 1];
  if (last?.role === "user") {
    const direct = tryDirectSectionAnswer(last.content, "car-loan");
    if (direct) {
      return { answer: direct.answer, state: { ...state, stage: null } };
    }
  }

  state.data = mergeKnown(state.data, extractCarLoanSignals(allUserText));

  if (last?.role === "user" && state.stage) {
    applyStageAnswer(state, last.content);
    state.data = mergeKnown(state.data, extractCarLoanSignals(last.content));
  }

  // If user gave enough numbers in one message, assess instead of asking from step 1
  const dAfter = state.data;
  const hasFullPicture =
    dAfter.vehiclePrice !== null &&
    dAfter.downPayment !== null &&
    dAfter.loanTermMonths !== null &&
    dAfter.grossMonthlyIncome !== null &&
    transportMonthly(dAfter) !== null;
  if (hasFullPicture) {
    return buildAssessment(state);
  }

  const d = state.data;
  const hasAny =
    d.vehiclePrice !== null ||
    d.downPayment !== null ||
    d.loanTermMonths !== null ||
    d.grossMonthlyIncome !== null ||
    d.monthlyCarPayment !== null ||
    d.monthlyTransportTotal !== null;

  if (!options?.forceTopic && !hasAny && !state.stage) return null;

  return nextCarLoanQuestion(state);
}
