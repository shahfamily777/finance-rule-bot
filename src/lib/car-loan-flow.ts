// Deterministic car-loan eligibility flow (20% down, ≤48 months, ≤10% transport).

import {
  intakeAcknowledgment,
  looksLikeBulkIntake,
  parseAprPercent,
  parseDownPaymentAmount,
  parseGrossMonthlyIncome,
  parsePurchasePrice,
} from "@/lib/intake-policy";
import { parseTermMonths, tryDirectSectionAnswer } from "@/lib/section-qa";

export type Msg = { role: "user" | "assistant"; content: string };

const MIN_DOWN_PCT = 20;
const MAX_TERM_MONTHS = 48;
const MAX_TRANSPORT_PCT = 10;

export type CarLoanStage =
  | "vehicle_price"
  | "down_payment"
  | "loan_term"
  | "gross_income"
  | "interest_rate"
  | "insurance"
  | "fuel"
  | null;

export type CarLoanConversationState = {
  stage: CarLoanStage;
  data: {
    vehiclePrice: number | null;
    downPayment: number | null;
    loanTermMonths: number | null;
    grossMonthlyIncome: number | null;
    annualInterestRatePct: number | null;
    /** Computed from price, down, term, and APR — not asked directly */
    monthlyCarPayment: number | null;
    monthlyInsurance: number | null;
    /** Monthly gas or EV charging estimate */
    monthlyFuel: number | null;
    isEv: boolean | null;
    /** Set when user gives one combined transport figure */
    monthlyTransportTotal: number | null;
    /** @deprecated Legacy field — no longer collected */
    monthlyMaintenance?: number | null;
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

function parseInterestRatePct(text: string, forStage = false): number | null {
  const fromPolicy = parseAprPercent(text);
  if (fromPolicy !== null) return fromPolicy;
  if (forStage) {
    const trimmed = text.trim();
    if (/^\d+(?:\.\d+)?%?$/.test(trimmed)) {
      const n = Number(trimmed.replace("%", ""));
      if (n > 0 && n <= 30) return n;
    }
  }
  return null;
}

/** Short income reply (e.g. "2k", "$6,000") when not a rate or term. */
function parseIncomeShortReply(text: string): number | null {
  if (/%/.test(text) || /\bmonths?\b/i.test(text) || /\byears?\b/i.test(text)) return null;
  const trimmed = text.trim();
  if (!/^[\d$,.\s]+(?:k|m|b)?$/i.test(trimmed)) return null;
  const amt = parseAmountToken(trimmed);
  if (amt === null || amt < 500 || amt > 2_000_000) return null;
  return amt;
}

function loanPrincipal(d: CarLoanConversationState["data"]): number | null {
  if (d.vehiclePrice === null || d.downPayment === null) return null;
  const p = d.vehiclePrice - d.downPayment;
  return p > 0 ? p : null;
}

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

function tryComputeMonthlyPayment(d: CarLoanConversationState["data"]): void {
  const principal = loanPrincipal(d);
  if (
    principal === null ||
    d.loanTermMonths === null ||
    d.annualInterestRatePct === null
  ) {
    return;
  }
  d.monthlyCarPayment = Math.round(
    computeMonthlyLoanPayment(principal, d.annualInterestRatePct, d.loanTermMonths)
  );
}

function detectsEv(text: string): boolean {
  return /\b(ev|electric|bev|plug[-\s]?in|charging|tesla)\b/i.test(text);
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

  out.vehiclePrice = parsePurchasePrice(text, "car");

  out.downPayment = parseDownPaymentAmount(text, out.vehiclePrice ?? null);
  if (out.downPayment == null && out.vehiclePrice) {
    out.downPayment = extractDownPaymentFromPercent(text, out.vehiclePrice);
  }

  const termMonths = text.match(/(\d+)\s*-?\s*months?\b/i);
  if (termMonths) {
    const n = Number(termMonths[1]);
    if (Number.isFinite(n)) out.loanTermMonths = n;
  }
  const termYears = text.match(/(\d+(?:\.\d+)?)\s*-?\s*years?\b/i);
  if (termYears && out.loanTermMonths === undefined) {
    const y = Number(termYears[1]);
    if (Number.isFinite(y)) out.loanTermMonths = Math.round(y * 12);
  }
  if (/\b48\s*months?\b|\b4\s*years?\b/i.test(text) && out.loanTermMonths == null) {
    out.loanTermMonths = 48;
  }

  out.grossMonthlyIncome = parseGrossMonthlyIncome(text);

  const rateSig = parseInterestRatePct(text);
  if (rateSig !== null) out.annualInterestRatePct = rateSig;

  out.monthlyCarPayment =
    firstAmount(
      text,
      /(?:car\s+)?(?:payment|note|loan\s+payment)\s*(?:of\s+)?\$?\s*([\d,]+(?:\.\d+)?)/i
    ) ?? null;

  if (detectsEv(text)) out.isEv = true;

  out.monthlyInsurance =
    firstAmount(text, /(?:auto\s+)?insurance\s*(?:of\s+)?\$?\s*([\d,]+(?:\.\d+)?)/i) ?? null;

  out.monthlyFuel =
    firstAmount(
      text,
      /(?:fuel|gas|gasoline|charging|ev\s+energy)\s*(?:of\s+)?\$?\s*([\d,]+(?:\.\d+)?)/i
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
  if (incoming && typeof incoming === "object" && incoming.data) {
    const legacyStage = incoming.stage as string | null;
    const stage: CarLoanStage =
      legacyStage === "car_payment"
        ? "interest_rate"
        : legacyStage === "maintenance"
          ? "fuel"
          : incoming.stage;
    const data = {
      ...incoming.data,
      annualInterestRatePct: incoming.data.annualInterestRatePct ?? null,
      isEv: incoming.data.isEv ?? null,
    };
    tryComputeMonthlyPayment(data);
    return { ...incoming, stage, data };
  }
  return {
    stage: null,
    data: {
      vehiclePrice: null,
      downPayment: null,
      loanTermMonths: null,
      grossMonthlyIncome: null,
      annualInterestRatePct: null,
      monthlyCarPayment: null,
      monthlyInsurance: null,
      monthlyFuel: null,
      isEv: null,
      monthlyTransportTotal: null,
    },
  };
}

function transportMonthly(d: CarLoanConversationState["data"]): number | null {
  if (d.monthlyTransportTotal !== null) return d.monthlyTransportTotal;
  tryComputeMonthlyPayment(d);
  const parts = [d.monthlyCarPayment, d.monthlyInsurance, d.monthlyFuel];
  if (parts.every((p) => p !== null)) {
    return parts.reduce((a, b) => a + (b ?? 0), 0);
  }
  return null;
}

function energyLabel(d: CarLoanConversationState["data"]): string {
  return d.isEv ? "EV charging" : "gas";
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
  if (d.annualInterestRatePct !== null && d.monthlyCarPayment !== null) {
    const principal = loanPrincipal(d);
    lines.push(
      `• Loan: ${d.annualInterestRatePct}% APR → **$${d.monthlyCarPayment.toLocaleString()}/mo** payment` +
        (principal !== null ? ` on $${principal.toLocaleString()} borrowed` : "")
    );
  }
  if (transport !== null && transportPct !== null) {
    lines.push(
      `• Monthly transportation: $${transport.toLocaleString()} (${transportPct.toFixed(1)}% of gross income — cap ${MAX_TRANSPORT_PCT}%) → ${transportOk ? "✓ Pass" : "✗ Over cap"}`
    );
    if (d.monthlyTransportTotal === null) {
      lines.push(
        `  (loan $${(d.monthlyCarPayment ?? 0).toLocaleString()} + insurance $${(d.monthlyInsurance ?? 0).toLocaleString()} + ${energyLabel(d)} $${(d.monthlyFuel ?? 0).toLocaleString()})`
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
        `• Lower total transportation (loan payment + insurance + gas or EV charging) to ≤${MAX_TRANSPORT_PCT}% of gross monthly income, or increase income / choose a cheaper car.`
      );
    }
  }

  return { answer: lines.join("\n"), state: { ...state, stage: null } };
}

function syncAllUserSignals(
  state: CarLoanConversationState,
  thread: Msg[]
): void {
  const blob = thread
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
  state.data = mergeKnown(state.data, extractCarLoanSignals(blob));
  tryComputeMonthlyPayment(state.data);
}

function carLoanContextSummary(d: CarLoanConversationState["data"]): string[] {
  const parts: string[] = [];
  if (d.vehiclePrice !== null) {
    parts.push(`**$${d.vehiclePrice.toLocaleString()}** vehicle`);
  }
  if (d.downPayment !== null) {
    const pct = downPaymentPct(d);
    parts.push(
      `**$${d.downPayment.toLocaleString()}** down` +
        (pct !== null ? ` (${pct.toFixed(0)}%)` : "")
    );
  }
  if (d.loanTermMonths !== null) {
    parts.push(`**${d.loanTermMonths}**-month term`);
  }
  if (d.grossMonthlyIncome !== null) {
    parts.push(`**$${d.grossMonthlyIncome.toLocaleString()}/mo** income`);
  }
  if (d.annualInterestRatePct !== null) {
    parts.push(`**${d.annualInterestRatePct}%** APR`);
  }
  return parts;
}

function nextCarLoanQuestion(
  state: CarLoanConversationState,
  options?: { acknowledge?: boolean }
): FlowResult {
  const d = state.data;
  tryComputeMonthlyPayment(d);
  const ack =
    options?.acknowledge !== false && carLoanContextSummary(d).length >= 2
      ? intakeAcknowledgment(carLoanContextSummary(d))
      : "";

  if (d.vehiclePrice === null) {
    return {
      answer:
        "What is the vehicle purchase price? (e.g. $32,000)",
      state: { ...state, stage: "vehicle_price" },
    };
  }
  if (d.downPayment === null) {
    return {
      answer:
        `${ack}How much will you put down? (Target: at least ${MIN_DOWN_PCT}% = $${Math.ceil(d.vehiclePrice * (MIN_DOWN_PCT / 100)).toLocaleString()} on this price)`,
      state: { ...state, stage: "down_payment" },
    };
  }
  if (d.loanTermMonths === null) {
    const downPct = downPaymentPct(d);
    const downNote =
      downPct !== null
        ? ` Down is ${downPct.toFixed(0)}% (${downPct >= MIN_DOWN_PCT ? "meets" : "below"} our **${MIN_DOWN_PCT}%** minimum).`
        : "";
    return {
      answer:
        `${ack}What **loan term in months**? Hard rule: maximum **48 months (4 years)** — no exceptions.${downNote}`,
      state: { ...state, stage: "loan_term" },
    };
  }
  if (d.grossMonthlyIncome === null) {
    return {
      answer:
        `${ack}What is your **gross monthly income** (before taxes)? We use it for the **≤10%** transportation rule.`,
      state: { ...state, stage: "gross_income" },
    };
  }

  tryComputeMonthlyPayment(d);

  const transport = transportMonthly(d);
  if (transport === null) {
    if (d.annualInterestRatePct === null && d.monthlyCarPayment === null) {
      const principal = loanPrincipal(d);
      const principalNote =
        principal !== null
          ? ` (amount financed ≈ **$${principal.toLocaleString()}** after your down payment)`
          : "";
      return {
        answer:
          `${ack}What **annual interest rate (APR %)** do you expect on the loan?${principalNote}\n\n` +
          "We will calculate your monthly loan payment from price, down payment, term, and rate.",
        state: { ...state, stage: "interest_rate" },
      };
    }
    if (d.monthlyInsurance === null) {
      let intro = ack;
      if (d.monthlyCarPayment !== null && d.annualInterestRatePct !== null) {
        const principal = loanPrincipal(d);
        intro =
          `At **${d.annualInterestRatePct}%** APR over **${d.loanTermMonths}** months, estimated loan payment is **$${d.monthlyCarPayment.toLocaleString()}/mo**` +
          (principal !== null ? ` ($${principal.toLocaleString()} financed).` : ".") +
          "\n\n";
      }
      return {
        answer: `${intro}What is your expected monthly **auto insurance**?`,
        state: { ...state, stage: "insurance" },
      };
    }
    if (d.monthlyFuel === null) {
      return {
        answer:
          `${ack}About how much per month for **gas**? If this is an **EV**, reply with your estimated monthly **charging** cost instead (e.g. \`$90 EV\`).`,
        state: { ...state, stage: "fuel" },
      };
    }
  }

  return buildAssessment(state);
}

function isFlowContinuationMessage(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/^(ok|okay|yes|yeah|y|nope|no|got it|i get it|sure|sounds good)\??\.?$/i.test(t)) {
    return true;
  }
  return (
    /^(ok|okay|yes|yeah|got it|i get it|sure|sounds good)[,.\s!?]/i.test(t) ||
    /(?:going with|lets go with|make it|use|i'?ll do|switch to)/i.test(t) ||
    /^\d/.test(t) ||
    /\d+\s*(?:months?|years?)/i.test(t) ||
    /^\d+(?:\.\d+)?\s*%$/.test(t)
  );
}

function termTooLongReply(months: number, state: CarLoanConversationState): FlowResult {
  return {
    answer:
      `**${months} months is too long** — our maximum is **48 months (4 years)**.\n\n` +
      "Please reply with **48** or fewer months (e.g. `48 months`), then we'll continue with income and transportation costs.",
    state: { ...state, stage: "loan_term", data: { ...state.data, loanTermMonths: months } },
  };
}

function termAcceptedReply(state: CarLoanConversationState): FlowResult | null {
  const d = state.data;
  if (d.loanTermMonths === null || d.loanTermMonths > MAX_TERM_MONTHS) return null;
  const next = nextCarLoanQuestion(state, { acknowledge: true });
  return {
    answer: `Got it — we'll use **${d.loanTermMonths} months** for the loan term.\n\n${next.answer}`,
    state: next.state,
  };
}

const MONEY_AMOUNT_STAGES: CarLoanStage[] = [
  "vehicle_price",
  "down_payment",
  "gross_income",
  "insurance",
  "fuel",
];

const RATE_STAGE: CarLoanStage = "interest_rate";

function isMoneyAmountStage(stage: CarLoanStage): boolean {
  return stage !== null && MONEY_AMOUNT_STAGES.includes(stage);
}

function looksLikeTermAnswer(text: string, stage: CarLoanStage): boolean {
  if (stage === "loan_term") return true;
  if (/\d+\s*(?:months?|mo|years?)\b/i.test(text)) return true;
  if (/(?:going with|let'?s go with|make it|use|switch to)\s*\d+/i.test(text)) return true;
  return false;
}

/** Apply answers even when stage was cleared (e.g. after a rule Q&A reply). */
function applyInferredFromMessage(
  state: CarLoanConversationState,
  userText: string
): void {
  state.data = mergeKnown(state.data, extractCarLoanSignals(userText));

  const rate = parseInterestRatePct(userText, true);
  if (rate !== null) {
    state.data.annualInterestRatePct = rate;
    tryComputeMonthlyPayment(state.data);
    return;
  }

  if (
    state.stage === "gross_income" ||
    (state.data.grossMonthlyIncome === null && parseIncomeShortReply(userText) !== null)
  ) {
    const inc = parseIncomeShortReply(userText);
    if (inc !== null) {
      state.data.grossMonthlyIncome = inc;
      return;
    }
  }

  if (state.stage === RATE_STAGE) {
    applyStageAnswer(state, userText);
    return;
  }

  if (isMoneyAmountStage(state.stage)) {
    applyStageAnswer(state, userText);
    return;
  }

  if (state.stage === "loan_term") {
    applyStageAnswer(state, userText);
    return;
  }

  if (looksLikeBulkIntake(userText)) {
    return;
  }

  if (state.stage) {
    applyStageAnswer(state, userText);
  }
}

function applyStageAnswer(
  state: CarLoanConversationState,
  userText: string
): void {
  const amt = parseAmountToken(userText) ?? firstAmount(userText, /([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)/i);
  const termM = userText.match(/(\d+)\s*-?\s*months?/i);
  const termY = userText.match(/(\d+(?:\.\d+)?)\s*-?\s*years?/i);

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
    case "interest_rate": {
      const rate = parseInterestRatePct(userText, true);
      if (rate !== null) {
        state.data.annualInterestRatePct = rate;
        tryComputeMonthlyPayment(state.data);
      }
      break;
    }
    case "insurance":
      if (amt !== null) state.data.monthlyInsurance = amt;
      break;
    case "fuel":
      if (detectsEv(userText)) state.data.isEv = true;
      else if (/\b(gas|gasoline|petrol)\b/i.test(userText)) state.data.isEv = false;
      if (amt !== null) {
        if (/transport/i.test(userText)) state.data.monthlyTransportTotal = amt;
        else state.data.monthlyFuel = amt;
      }
      break;
    default:
      break;
  }
}

/** When client state is missing, infer checklist from recent assistant prompts. */
export function inferCarLoanFlowFromThread(thread: Msg[]): boolean {
  const lastAssistant = [...thread].reverse().find((m) => m.role === "assistant");
  if (
    lastAssistant &&
    /(?:vehicle purchase price|put down|loan term in months|gross monthly income|interest rate|APR|auto insurance|gas|EV|charging|transportation)/i.test(
      lastAssistant.content
    )
  ) {
    return true;
  }
  const userBlob = thread
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
  const partial = extractCarLoanSignals(userBlob);
  return (
    partial.vehiclePrice != null ||
    partial.downPayment != null ||
    partial.loanTermMonths != null
  );
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
    d.annualInterestRatePct !== null ||
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
  syncAllUserSignals(state, thread);

  const last = thread[thread.length - 1];
  const active = isCarLoanFlowActive(state);
  let continuation = false;

  if (last?.role === "user") {
    continuation = active && isFlowContinuationMessage(last.content);

    const bulk =
      looksLikeBulkIntake(last.content) || carLoanContextSummary(state.data).length >= 2;

    if (!continuation && !bulk) {
      const direct = tryDirectSectionAnswer(last.content, "car-loan");
      if (direct) {
        return {
          answer: direct.answer,
          state: { ...state, stage: state.stage, data: state.data },
        };
      }
    }

    const stageBefore = state.stage;
    applyInferredFromMessage(state, last.content);
    syncAllUserSignals(state, thread);

    const termReply = looksLikeTermAnswer(last.content, stageBefore);

    if (
      termReply &&
      state.data.loanTermMonths !== null &&
      state.data.loanTermMonths > MAX_TERM_MONTHS
    ) {
      return termTooLongReply(state.data.loanTermMonths, state);
    }

    if (
      termReply &&
      state.data.loanTermMonths !== null &&
      state.data.loanTermMonths <= MAX_TERM_MONTHS &&
      continuation &&
      state.data.grossMonthlyIncome === null
    ) {
      const accepted = termAcceptedReply(state);
      if (accepted) return accepted;
    }
  }

  // If user gave enough numbers in one message, assess instead of asking from step 1
  const dAfter = state.data;
  tryComputeMonthlyPayment(dAfter);

  const hasFullPicture =
    dAfter.vehiclePrice !== null &&
    dAfter.downPayment !== null &&
    dAfter.loanTermMonths !== null &&
    dAfter.grossMonthlyIncome !== null &&
    (dAfter.annualInterestRatePct !== null || dAfter.monthlyCarPayment !== null) &&
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

  const softOk =
    last?.role === "user" &&
    /^(ok|okay|yes|sure)\??\.?$/i.test(last.content.trim()) &&
    state.data.annualInterestRatePct !== null;

  return nextCarLoanQuestion(state, {
    acknowledge: !softOk && !continuation,
  });
}
