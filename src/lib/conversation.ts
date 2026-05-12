// Lightweight, deterministic conversational flow.
// Goal: ask ONE follow-up at a time in the priority order, but also infer
// answers if the user provides them in one paragraph.
//
// IMPORTANT: We only output the full plan if the user explicitly asks for it.

export type Msg = { role: "user" | "assistant"; content: string };

const STARTER_EF_TARGET = 2000;

export type ConversationState = {
  stage:
    | "match"
    | "starter_emergency"
    | "high_interest_debt"
    | "full_emergency"
    | "hsa"
    | "roth"
    | "max_401k"
    | "plan_offer"
    | null;
  data: {
    investAmount: number | null;
    debtAmount: number | null;

    has401kMatch: boolean | null;
    hasStarterEmergencyFund: boolean | null;
    hasHighInterestDebt: boolean | null;

    hasFullEmergencyFund: boolean | null;
    hsaEligible: boolean | null;
    hasRothIra: boolean | null;
    maxing401k: boolean | null;
  };
};

type PartialSignals = Partial<ConversationState["data"]>;

type FlowResult = { answer: string; state: ConversationState };

function parseAmountToken(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  const m = cleaned.match(/\$?\s*(\d+(?:\.\d+)?)(?:\s*(k|m|b)\b)?/i);
  if (!m) return null;

  const base = Number(m[1]);
  if (!Number.isFinite(base)) return null;

  const suffix = (m[2] || "").toLowerCase();
  const multiplier =
    suffix === "k"
      ? 1_000
      : suffix === "m"
        ? 1_000_000
        : suffix === "b"
          ? 1_000_000_000
          : 1;

  return base * multiplier;
}

function parseAmountNearKeyword(text: string, keywordPattern: string): number | null {
  // keyword ... amount
  {
    const re = new RegExp(
      `${keywordPattern}[^\\d$]{0,30}(\\$?\\s*\\d[\\d,]*(?:\\.\\d+)?\\s*(?:k|m|b)?\\b)`,
      "i"
    );
    const m = text.match(re);
    if (m?.[1]) {
      const n = parseAmountToken(m[1]);
      if (n !== null) return n;
    }
  }

  // amount ... keyword
  {
    const re = new RegExp(
      `(\\$?\\s*\\d[\\d,]*(?:\\.\\d+)?\\s*(?:k|m|b)?\\b)[^\\w]{0,20}${keywordPattern}`,
      "i"
    );
    const m = text.match(re);
    if (m?.[1]) {
      const n = parseAmountToken(m[1]);
      if (n !== null) return n;
    }
  }

  return null;
}

function parseMonthsOfExpenses(text: string): number | null {
  // e.g. "3 months", "6 months", "3-6 months" (we take the first number)
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*(month|months)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function mentionsInvest(message: string): boolean {
  return /(invest|investing|investment|to invest|put\s+.*into|allocate|where should.*go)/i.test(
    message
  );
}

function userAsksForPlan(text: string): boolean {
  return /(full\s+plan|give\s+me\s+a\s+plan|summary|summarize|step\s*-?by\s*-?step|what\s+should\s+i\s+do|recommend|next\s+steps)/i.test(
    text
  );
}

function parseYesNo(message: string): boolean | null {
  const m = message.trim().toLowerCase();
  if (["y", "yes", "yeah", "yep", "sure", "true", "ok", "okay"].includes(m)) return true;
  if (["n", "no", "nope", "false"].includes(m)) return false;

  // Handle common sentences
  if (/\b(i\s+do|i\s+have|i\s+am|yes|yeah|yep|correct)\b/i.test(m)) return true;
  if (/\b(i\s+don\'t|i\s+do\s+not|i\s+dont|no|nope|none)\b/i.test(m)) return false;

  return null;
}

function lastAssistant(thread: Msg[]): string | null {
  for (let i = thread.length - 1; i >= 0; i--) {
    if (thread[i].role === "assistant") return thread[i].content;
  }
  return null;
}

function initState(incoming?: ConversationState | null): ConversationState {
  if (incoming && typeof incoming === "object" && incoming.data) return incoming;
  return {
    stage: null,
    data: {
      investAmount: null,
      debtAmount: null,
      has401kMatch: null,
      hasStarterEmergencyFund: null,
      hasHighInterestDebt: null,
      hasFullEmergencyFund: null,
      hsaEligible: null,
      hasRothIra: null,
      maxing401k: null,
    },
  };
}

function extractSignalsFromText(text: string): PartialSignals {
  const out: PartialSignals = {};

  out.investAmount =
    parseAmountNearKeyword(text, "(invest|investing|to invest|investment)") ?? null;

  out.debtAmount =
    parseAmountNearKeyword(text, "(debt|owe|owed|credit\\s*card|cc\\b|loan)") ?? null;

  // 401k match
  const saysHasMatch =
    /((401\s*k|401k).{0,40}match|employer\s+match)/i.test(text) &&
    !/(no\s+match|doesn\'?t\s+match|without\s+match)/i.test(text);
  const saysNoMatch = /(no\s+match|doesn\'?t\s+match|without\s+match)/i.test(text);
  if (saysHasMatch) out.has401kMatch = true;
  if (saysNoMatch) out.has401kMatch = false;

  // Starter emergency fund
  const efAmount = parseAmountNearKeyword(
    text,
    "(starter\\s+emergency|emergency\\s+fund|emergency\\s+savings|cash\\s+cushion)"
  );
  const saysNoEf = /(no\s+emergency\s+fund|don\'?t\s+have\s+an?\s+emergency\s+fund)/i.test(
    text
  );
  if (saysNoEf) out.hasStarterEmergencyFund = false;
  if (efAmount !== null) out.hasStarterEmergencyFund = efAmount >= STARTER_EF_TARGET;

  // High-interest debt
  const saysNoDebt = /(\bno\s+debt\b|\bdebt[-\s]?free\b)/i.test(text);
  const mentionsDebt = /(\bdebt\b|\bowe\b|\bowed\b|credit\s*card|\bcc\b|loan)/i.test(text);
  const mentionsHigh = /(high\s*interest|\bapr\b|\b\d{1,2}%\b|credit\s*card|\bcc\b|personal\s+loan)/i.test(
    text
  );
  const mentionsLow = /(mortgage|student\s+loan|auto\s+loan|car\s+loan|low\s*interest)/i.test(
    text
  );

  if (saysNoDebt) out.hasHighInterestDebt = false;
  else if (mentionsDebt && mentionsHigh) out.hasHighInterestDebt = true;
  else if (mentionsDebt && mentionsLow) out.hasHighInterestDebt = false;

  // Full emergency fund (3-6 months)
  const months = parseMonthsOfExpenses(text);
  if (/fully\s+funded\s+emergency/i.test(text)) out.hasFullEmergencyFund = true;
  if (months !== null) out.hasFullEmergencyFund = months >= 3;

  // HSA eligible
  const saysHsaYes = /(\bhsa\b|high\s+deductible|hdhp)/i.test(text) && !/not\s+eligible|no\s+hsa/i.test(text);
  const saysHsaNo = /(not\s+eligible|no\s+hsa)/i.test(text);
  if (saysHsaYes) out.hsaEligible = true;
  if (saysHsaNo) out.hsaEligible = false;

  // Roth IRA
  const saysRothYes = /(roth\s+ira|have\s+a\s+roth|contribute\s+to\s+roth)/i.test(text);
  const saysRothNo = /(no\s+roth|don\'?t\s+have\s+a\s+roth)/i.test(text);
  if (saysRothYes) out.hasRothIra = true;
  if (saysRothNo) out.hasRothIra = false;

  // Maxing 401k
  const saysMaxYes = /(max\s+out\s+401k|maxing\s+401k|hit\s+the\s+401k\s+limit)/i.test(text);
  const saysMaxNo = /(not\s+maxing|not\s+maxed|can\'?t\s+max)/i.test(text);
  if (saysMaxYes) out.maxing401k = true;
  if (saysMaxNo) out.maxing401k = false;

  return out;
}

function mergeKnown(base: ConversationState["data"], next: PartialSignals): ConversationState["data"] {
  const merged: ConversationState["data"] = { ...base };
  for (const [k, v] of Object.entries(next)) {
    const key = k as keyof ConversationState["data"];
    if (v === undefined || v === null) continue;
    if (merged[key] === null) {
      // only fill missing
      merged[key] = v as never;
    }
  }
  return merged;
}

function nextQuestion(state: ConversationState, wantsPlan: boolean): FlowResult {
  const d = state.data;

  // 1) match
  if (d.has401kMatch === null) {
    return {
      answer: "Do you have a 401(k) (or similar) with an employer match?",
      state: { ...state, stage: "match" },
    };
  }

  // 2) starter emergency
  if (d.hasStarterEmergencyFund === null) {
    return {
      answer: `Do you have at least about $${STARTER_EF_TARGET.toLocaleString()} set aside as an emergency fund?`,
      state: { ...state, stage: "starter_emergency" },
    };
  }

  // 3) high-interest debt
  if (d.hasHighInterestDebt === null) {
    return {
      answer: "Do you have any high-interest debt (like credit cards or personal loans)?",
      state: { ...state, stage: "high_interest_debt" },
    };
  }

  // 4) full emergency
  if (d.hasFullEmergencyFund === null) {
    return {
      answer: "Do you have a fully funded emergency fund (about 3–6 months of expenses)?",
      state: { ...state, stage: "full_emergency" },
    };
  }

  // 5) HSA
  if (d.hsaEligible === null) {
    return {
      answer: "Are you eligible to contribute to an HSA (high-deductible health plan / HDHP)?",
      state: { ...state, stage: "hsa" },
    };
  }

  // 6) Roth IRA
  if (d.hasRothIra === null) {
    return {
      answer: "Do you already contribute to a Roth IRA (or plan to this year)?",
      state: { ...state, stage: "roth" },
    };
  }

  // 7) max retirement
  if (d.maxing401k === null) {
    return {
      answer: "Are you already maxing out your 401(k) contributions (hitting the annual limit)?",
      state: { ...state, stage: "max_401k" },
    };
  }

  // We have enough context; only give plan if asked.
  if (!wantsPlan) {
    return {
      answer: "I’ve got enough info. If you want, ask: “give me the full plan” and I’ll summarize the step-by-step order for your money.",
      state: { ...state, stage: "plan_offer" },
    };
  }

  // Full plan
  const investText = d.investAmount !== null ? `$${d.investAmount.toLocaleString()}` : "your money";
  const lines: string[] = [];
  lines.push(`Plan for ${investText} (in order):`);
  lines.push(
    d.has401kMatch
      ? "1) Contribute enough to get the full 401(k) employer match (free money)."
      : "1) If you have a 401(k) match, capture it first."
  );
  lines.push(
    d.hasStarterEmergencyFund
      ? `2) Keep at least ~$${STARTER_EF_TARGET.toLocaleString()} in a starter emergency fund.`
      : `2) Build a starter emergency fund of ~$${STARTER_EF_TARGET.toLocaleString()} first.`
  );
  lines.push(
    d.hasHighInterestDebt
      ? "3) Pay down high-interest debt aggressively before investing extra."
      : "3) If you have no high-interest debt, move on to long-term investing."
  );
  lines.push(
    d.hasFullEmergencyFund
      ? "4) Maintain a full emergency fund (3–6 months) before taking additional risk."
      : "4) Build your emergency fund toward 3–6 months of expenses."
  );
  lines.push(
    d.hsaEligible
      ? "5) If eligible, consider prioritizing HSA contributions (triple tax advantage)."
      : "5) If not HSA-eligible, skip this step."
  );
  lines.push(
    d.hasRothIra
      ? "6) Continue IRA contributions as appropriate (Roth/Traditional based on taxes)."
      : "6) Consider funding a Roth IRA (or Traditional IRA) if eligible."
  );
  lines.push(
    d.maxing401k
      ? "7) If already maxing the 401(k), invest remaining long-term money in a taxable brokerage."
      : "7) Increase 401(k) contributions toward the annual limit as you can."
  );
  lines.push(
    "8) Invest remaining long-term money in diversified, low-cost index funds (taxable brokerage)."
  );

  return { answer: lines.join("\n"), state: { ...state, stage: null } };
}

export function handleConversationalFlow(
  thread: Msg[],
  incomingState?: ConversationState | null
): FlowResult | null {
  const allUserText = thread
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");

  if (!mentionsInvest(allUserText)) return null;

  const state = initState(incomingState);
  const extracted = extractSignalsFromText(allUserText);
  state.data = mergeKnown(state.data, extracted);

  // If user never mentioned an invest amount, don't take over.
  if (state.data.investAmount === null) return null;

  // Apply a Yes/No to the last asked question.
  const last = thread[thread.length - 1];
  const yn = last?.role === "user" ? parseYesNo(last.content) : null;
  if (yn !== null && state.stage) {
    if (state.stage === "match") state.data.has401kMatch = yn;
    if (state.stage === "starter_emergency") state.data.hasStarterEmergencyFund = yn;
    if (state.stage === "high_interest_debt") state.data.hasHighInterestDebt = yn;
    if (state.stage === "full_emergency") state.data.hasFullEmergencyFund = yn;
    if (state.stage === "hsa") state.data.hsaEligible = yn;
    if (state.stage === "roth") state.data.hasRothIra = yn;
    if (state.stage === "max_401k") state.data.maxing401k = yn;
    if (state.stage === "plan_offer" && yn) {
      // treat as a request for plan
    }
  }

  const wantsPlan = userAsksForPlan(allUserText) || (state.stage === "plan_offer" && yn === true);
  return nextQuestion(state, wantsPlan);
}
