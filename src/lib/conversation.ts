// Lightweight, deterministic conversational flow for the first few turns.
// Goal: be conversational (one question at a time) BUT also understand when
// the user provides multiple answers in one paragraph.
//
// Priority order for this quick flow:
// 1) 401(k) match (free money)
// 2) Starter emergency fund (~$2,000)
// 3) High-interest debt
// 4) Then investing

export type Msg = { role: "user" | "assistant"; content: string };

type Signals = {
  investAmount: number | null;
  debtAmount: number | null;

  has401kMatch: boolean | null;
  hasStarterEmergencyFund: boolean | null;

  hasDebt: boolean | null;
  highInterestDebt: boolean | null;
};

const STARTER_EF_TARGET = 2000;

function parseAmountToken(raw: string): number | null {
  // Supports: "$19,000", "19000", "19k", "19 k", "19K", "1.5m".
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
  // Try: keyword ... amount
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

  // Try: amount ... keyword
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

function mentionsInvest(message: string): boolean {
  return /(invest|investing|investment|to invest|put\s+.*into|allocate|where should.*go)/i.test(
    message
  );
}

function parseYesNo(message: string): boolean | null {
  const m = message.trim().toLowerCase();
  if (["y", "yes", "yeah", "yep", "sure", "true"].includes(m)) return true;
  if (["n", "no", "nope", "false"].includes(m)) return false;

  // Heuristics for sentences
  if (/\b(yes|yeah|yep|correct)\b/i.test(m)) return true;
  if (/\b(no|nope|don\'t|do not|none)\b/i.test(m)) return false;
  return null;
}

function lastAssistant(thread: Msg[]): string | null {
  for (let i = thread.length - 1; i >= 0; i--) {
    if (thread[i].role === "assistant") return thread[i].content;
  }
  return null;
}

function extractSignalsFromUserText(userText: string): Signals {
  const investAmount = parseAmountNearKeyword(
    userText,
    "(invest|investing|to invest|investment)"
  );
  const debtAmount = parseAmountNearKeyword(
    userText,
    "(debt|owe|owed|credit\\s*card|cc\\b|loan)"
  );

  // 401k match
  const saysHasMatch =
    /((401\s*k|401k).{0,40}match|employer\s+match)/i.test(userText) &&
    !/(no\s+match|doesn\'?t\s+match|without\s+match)/i.test(userText);
  const saysNoMatch = /(no\s+match|doesn\'?t\s+match|without\s+match)/i.test(userText);
  const has401kMatch: boolean | null = saysNoMatch ? false : saysHasMatch ? true : null;

  // Starter emergency fund
  const efAmount = parseAmountNearKeyword(
    userText,
    "(emergency\\s+fund|emergency\\s+savings|cash\\s+cushion)"
  );
  const saysNoEf = /(no\s+emergency\s+fund|don\'?t\s+have\s+an?\s+emergency\s+fund)/i.test(
    userText
  );
  const saysHasEf =
    /(emergency\s+fund|emergency\s+savings|cash\s+cushion)/i.test(userText) &&
    !saysNoEf;

  const hasStarterEmergencyFund: boolean | null =
    saysNoEf
      ? false
      : efAmount !== null
        ? efAmount >= STARTER_EF_TARGET
        : saysHasEf
          ? null // they mentioned it but didn't confirm amount >= target
          : null;

  // Debt yes/no
  const saysNoDebt = /(\bno\s+debt\b|\bdebt[-\s]?free\b|\bwithout\s+debt\b)/i.test(
    userText
  );
  const saysHasDebt =
    /(\bdebt\b|\bowe\b|\bowed\b|credit\s*card|\bcc\b|loan)/i.test(userText) &&
    !saysNoDebt;
  const hasDebt: boolean | null = saysNoDebt ? false : saysHasDebt ? true : null;

  // High-interest debt: explicit/heuristic
  const mentionsHigh = /(high\s*interest|\bapr\b|\b\d{1,2}%\b|credit\s*card|\bcc\b|personal\s+loan)/i.test(
    userText
  );
  const mentionsLow = /(low\s*interest|mortgage|student\s+loan|auto\s+loan|car\s+loan)/i.test(
    userText
  );

  const highInterestDebt: boolean | null =
    hasDebt === false ? false : mentionsHigh ? true : mentionsLow ? false : null;

  return {
    investAmount,
    debtAmount,
    has401kMatch,
    hasStarterEmergencyFund,
    hasDebt,
    highInterestDebt,
  };
}

const ASK_MATCH_PROMPT = "employer match";
const ASK_STARTER_EF_PROMPT = "starter emergency fund";
const ASK_HI_DEBT_PROMPT = "high-interest debt";

function buildPlan(s: Signals): string {
  const investText =
    s.investAmount !== null ? `$${s.investAmount.toLocaleString()}` : "your money";

  const lines: string[] = [];
  lines.push(`Here’s the order I’d use for your ${investText}:`);

  if (s.has401kMatch) {
    lines.push(
      "1) First: contribute enough to get the full 401(k) employer match (it’s free money)."
    );
  } else {
    lines.push(
      "1) If you have a workplace plan match, grab it first. If you don’t have a match, we’ll move on."
    );
  }

  if (s.hasStarterEmergencyFund === false) {
    lines.push(
      `2) Next: set aside a starter emergency fund of about $${STARTER_EF_TARGET.toLocaleString()} in cash.`
    );
  } else {
    lines.push(
      `2) Keep at least about $${STARTER_EF_TARGET.toLocaleString()} set aside as a starter emergency fund.`
    );
  }

  if (s.highInterestDebt) {
    const debtText =
      s.debtAmount !== null
        ? `$${s.debtAmount.toLocaleString()}`
        : "your high-interest debt";
    lines.push(`3) Then: aggressively pay down ${debtText} before investing extra.`);
    lines.push(
      "4) After the high-interest debt is gone, we can invest the remaining long-term money in diversified low-cost index funds."
    );
  } else {
    lines.push(
      "3) If you don’t have high-interest debt, then you can invest the remaining long-term money in diversified low-cost index funds."
    );
  }

  return lines.join("\n");
}

export function handleConversationalFlow(thread: Msg[]): string | null {
  if (!Array.isArray(thread) || thread.length === 0) return null;

  const last = thread[thread.length - 1];
  const lastAssistantText = (lastAssistant(thread) || "").toLowerCase();

  const allUserText = thread
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");

  if (!mentionsInvest(allUserText)) return null;

  const signals = extractSignalsFromUserText(allUserText);
  if (signals.investAmount === null) return null;

  // If the last message is a simple Yes/No, interpret it based on what was asked.
  const yn = last.role === "user" ? parseYesNo(last.content) : null;
  const derived: Signals = { ...signals };

  if (yn !== null) {
    if (lastAssistantText.includes(ASK_MATCH_PROMPT)) {
      derived.has401kMatch = yn;
    } else if (lastAssistantText.includes(ASK_STARTER_EF_PROMPT)) {
      derived.hasStarterEmergencyFund = yn;
    } else if (lastAssistantText.includes(ASK_HI_DEBT_PROMPT)) {
      derived.highInterestDebt = yn;
      if (yn) derived.hasDebt = true;
    }
  }

  // Ask next missing question (one at a time)
  if (derived.has401kMatch === null) {
    return "Do you have a 401(k) (or similar) with an employer match? Yes or No";
  }

  if (derived.hasStarterEmergencyFund === null) {
    return `Do you have at least about $${STARTER_EF_TARGET.toLocaleString()} set aside as a starter emergency fund? Yes or No`;
  }

  if (derived.highInterestDebt === null) {
    if (derived.hasDebt === false) {
      derived.highInterestDebt = false;
    } else {
      return "Do you have any high-interest debt (like credit cards or personal loans)? Yes or No";
    }
  }

  return buildPlan(derived);
}
