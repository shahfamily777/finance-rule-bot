/**
 * Section Q&A: answer clear rule questions directly (common sense),
 * then fall back to guided intake flows. Used by all three topics.
 *
 * Policy: questions first — never skip to the next intake prompt while a
 * finance question is unanswered. No web lookup; if we lack an answer, say so.
 */
import { ORDER_OF_OPERATIONS } from "@/lib/rules";

export type TopicId = "car-loan" | "mortgage" | "investment";

export type DirectAnswer = {
  answer: string;
  /** If true, do not restart the intake questionnaire */
  preserveState: boolean;
};

// --- Relevance (user is already IN a section — don't require "car loan" in every message) ---

export function relatesToCarLoanSection(text: string): boolean {
  if (mentionsCarLoanExplicit(text)) return true;
  if (mentionsMortgageExplicit(text) && !/(car|auto|vehicle|suv)/i.test(text)) return false;
  if (mentionsInvestmentExplicit(text) && !/(car|auto|vehicle|transport)/i.test(text))
    return false;

  return (
    /\b(72|60|84|96|48|36)\s*[-\s]?(?:months?|mo)\b/i.test(text) ||
    /loan\s+term|financing\s+term|how\s+long\s+(?:should|can)|too\s+long/i.test(text) ||
    /down\s+payment|\d+\s*%\s*down|twenty\s+percent\s+down|20\s*%\s+down/i.test(text) ||
    /transportation|transport\s+cost|10\s*%\s+of\s+(?:my\s+)?income/i.test(text) ||
    /upside\s+down|depreciat/i.test(text) ||
    /(?:car|auto|vehicle).{0,25}(?:loan|payment|financ|afford)/i.test(text) ||
    /(?:loan|payment|financ).{0,25}(?:car|auto|vehicle)/i.test(text) ||
    /(?:what\s+are\s+(?:the\s+)?rules|your\s+rules|eligibility)/i.test(text)
  );
}

export function relatesToMortgageSection(text: string): boolean {
  if (mentionsMortgageExplicit(text)) return true;
  if (mentionsCarLoanExplicit(text) && !mentionsMortgageExplicit(text)) return false;

  return (
    /purchase\s*price|home\s*price|house\s*price|asking\s*price/i.test(text) ||
    /\$?\s*[\d,]+(?:\.\d+)?\s*(?:k|m|b)\b/i.test(text) ||
    /gross\s+income|monthly\s+income/i.test(text) ||
    /property\s*tax|homeowners?\s+insurance|\bhoa\b/i.test(text) ||
    /\b(15|30)\s*[-\s]?years?/i.test(text) ||
    /refinanc|refi\b|1\s*%|one\s+percent/i.test(text) ||
    /closing\s+cost|emergency\s+fund/i.test(text) ||
    /rent(?:ing)?\s+(?:vs|instead)|ready\s+to\s+buy|down\s+payment/i.test(text) ||
    /interest\s+rate|pay\s+off\s+early|extra\s+principal|35\s*%/i.test(text) ||
    /(?:what\s+are\s+(?:the\s+)?rules|your\s+rules)/i.test(text)
  );
}

/** In mortgage section: dollar amounts / home-buying fields are on-topic (not “wrong section”). */
export function isMortgageContextMessage(text: string): boolean {
  return relatesToMortgageSection(text);
}

export function relatesToInvestmentSection(text: string): boolean {
  if (mentionsInvestmentExplicit(text)) return true;
  if (mentionsCarLoanExplicit(text) || mentionsMortgageExplicit(text)) return false;

  return (
    /401\s*k|roth|ira|hsa|emergency\s+fund|invest|debt|savings|retirement|match/i.test(
      text
    ) || /(?:what\s+are\s+(?:the\s+)?rules|where\s+should\s+i\s+put)/i.test(text)
  );
}

export function relatesToSection(text: string, topic: TopicId): boolean {
  switch (topic) {
    case "car-loan":
      return relatesToCarLoanSection(text);
    case "mortgage":
      return relatesToMortgageSection(text);
    case "investment":
      return relatesToInvestmentSection(text);
  }
}

function mentionsCarLoanExplicit(text: string): boolean {
  return /(car\s+loan|auto\s+loan|vehicle\s+loan|financ(?:e|ing)\s+a\s+car|buy(?:ing)?\s+a\s+car)/i.test(
    text
  );
}

function mentionsMortgageExplicit(text: string): boolean {
  if (/(car|auto|vehicle)/i.test(text)) return false;
  return /(mortgage|home\s+loan|house\s+loan|buy(?:ing)?\s+a\s+house|refinanc)/i.test(text);
}

function mentionsInvestmentExplicit(text: string): boolean {
  const q = text.toLowerCase();
  return ["401k", "roth", "ira", "hsa", "invest", "emergency fund", "retirement"].some(
    (k) => q.includes(k)
  );
}

function parseTermMonths(text: string): number | null {
  const m = text.match(/\b(\d+)\s*[-\s]?(?:months?|mo)\b/i);
  if (m) return Number(m[1]);
  const y = text.match(/\b(\d+)\s*[-\s]?years?\b/i);
  if (y) return Number(y[1]) * 12;
  if (/\b(60|72|84|96)\b/.test(text)) {
    const n = text.match(/\b(60|72|84|96)\b/);
    if (n) return Number(n[1]);
  }
  return null;
}

/** Loan-term or rule question (answer directly — not intake data). */
export function isCarLoanRuleQuestion(text: string): boolean {
  const t = text.trim();
  return (
    /too\s+long|too\s+short/i.test(t) ||
    /\b(?:60|72|84|96|48)\s*[-\s]?(?:months?|mo)\b/i.test(t) ||
    /\b\d+\s*[-\s]?(?:months?|mo)\b/i.test(t) ||
    /loan\s+term|max(?:imum)?\s+term/i.test(t) ||
    /20\s*%\s*down|ten\s+percent|10\s*%/i.test(t) ||
    /transportation|upside\s+down/i.test(t) ||
    /(?:what\s+are\s+(?:the\s+)?rules|your\s+rules)/i.test(t)
  );
}

export function isUserAskingQuestion(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (isCarLoanRuleQuestion(t)) return true;
  return (
    /\?/.test(t) ||
    /^(?:is|are|can|should|what|how|why|do|does|would|could|tell\s+me|explain)\b/i.test(
      t
    ) ||
    /\b(?:what\s+is|how\s+does|should\s+i|is\s+it|is\s+\d+|are\s+\d+)\b/i.test(t)
  );
}

/** User is replying with data to a guided flow — not asking a new question. */
export function isIntakeDataMessage(text: string, inActiveFlow: boolean): boolean {
  const t = text.trim();
  if (!t) return false;
  if (isCarLoanRuleQuestion(t)) return false;
  if (isMortgageContextMessage(t) && /\$?\s*[\d,]+/.test(t) && !isUserAskingQuestion(t))
    return true;
  if (isUserAskingQuestion(t) && !isMortgageContextMessage(t) && !isCarLoanRuleQuestion(t))
    return false;
  if (inActiveFlow) {
    if (/^(y|yes|no|nope|yeah|n|ok|okay)\.?$/i.test(t)) return true;
    if (/^\$?[\d,]+/.test(t) && !/too\s+long/i.test(t)) return true;
    if (
      /^\d+\s*[-\s]?(?:months?|years?|mo)\b\.?$/i.test(t) ||
      (/^\d+\s*[-\s]?(?:months?|mo)\b/i.test(t) && t.length < 30)
    )
      return true;
  }
  if (/(?:here\s+are|my\s+numbers|check\s+my|run\s+(?:the\s+)?checklist)/i.test(t))
    return true;
  if (/\$\s*[\d,]+/.test(t) && !isUserAskingQuestion(t)) return true;
  return false;
}

const SECTION_LABEL: Record<TopicId, string> = {
  "car-loan": "Car loan",
  mortgage: "Mortgage",
  investment: "Investment (personal finance)",
};

/** When we have no rule-based answer — do not guess or search externally. */
export function getUnknownDomainReply(topic: TopicId): DirectAnswer {
  const hints: Record<TopicId, string> = {
    "car-loan":
      "20% down, loan term (max 48 months), transportation vs income, or “what are the rules?”",
    mortgage:
      "15/30-year loans, refinance (1% rate drop), readiness to buy vs rent, or rates above 5%",
    investment:
      "401(k) match, emergency fund, debt vs invest order, HSA/Roth, or “where should I put $X?”",
  };
  return {
    answer:
      `I don’t have an answer for that in **${SECTION_LABEL[topic]}**.\n\n` +
      "I only respond from **fixed rules in this app** — I don’t look things up online and I won’t guess.\n\n" +
      `You can ask about: ${hints[topic]}.\n\n` +
      "For another area, use **All topics** → the right section.",
    preserveState: true,
  };
}

function isQuestion(text: string): boolean {
  return isUserAskingQuestion(text);
}

/** User wants permission to break the 48-month rule (not asking if long terms are bad). */
function seeksCarLoanTermException(text: string): boolean {
  const months = parseTermMonths(text);
  if (months !== null && months > 48) {
    if (/too\s+long|bad\s+idea|should\s+i\s+avoid|not\s+ok|wrong|recommend|advise/i.test(text))
      return false;
    if (
      /(?:can\s+i|is\s+it\s+ok|okay\s+if|would\s+you|allow|approve|exception|make\s+sense)\b/i.test(
        text
      )
    )
      return true;
  }
  return (
    /(exception|compromise|bend|waive|flexible).{0,20}(rule|48|4\s*year)/i.test(text) ||
    /(?:can\s+i|is\s+it\s+ok).{0,30}(60|72|84|96)\s*[-\s]?month/i.test(text)
  );
}

function carLoanTermTooLongAnswer(months: number): DirectAnswer {
  return {
    answer:
      `Yes — **${months} months is too long** for a car loan here.\n\n` +
      "Our hard maximum is **48 months (4 years)**. We do not use 60-, 72-, or longer terms.\n\n" +
      "Use **48 months or less**, or buy a cheaper car / put more down / wait — do not stretch the loan.",
    preserveState: true,
  };
}

function answerCarLoanDirect(text: string): DirectAnswer | null {
  const t = text.trim();
  const months = parseTermMonths(t);

  if (/too\s+long/i.test(t) && (months !== null && months > 48 || /\b(60|72|84|96)\b/.test(t))) {
    const m = months ?? (/\b72\b/.test(t) ? 72 : /\b60\b/.test(t) ? 60 : 84);
    return carLoanTermTooLongAnswer(m);
  }

  if (/(?:what\s+are\s+(?:the\s+)?rules|your\s+rules|three\s+rules)/i.test(t)) {
    return {
      answer:
        "Car loan rules (fixed):\n\n" +
        "1) **Down payment:** at least **20%** of the vehicle price (avoids owing more than the car is worth).\n" +
        "2) **Loan term:** **48 months (4 years) maximum** — no exceptions. Not 60, not 72.\n" +
        "3) **Transportation budget:** payment + insurance + fuel + maintenance ≤ **10%** of gross monthly income.\n\n" +
        "Share your numbers anytime for a full checklist, or ask a specific question (e.g. “Is 72 months too long?”).",
      preserveState: true,
    };
  }

  if (seeksCarLoanTermException(t)) {
    return {
      answer:
        "No — we do not allow or recommend car loans longer than **48 months (4 years)** under any circumstance.\n\n" +
        "If the payment only works at 60 or 72 months, the fix is a **cheaper car**, **more down**, or **waiting** — not a longer loan.",
      preserveState: true,
    };
  }

  if (months !== null && months > 48) {
    return carLoanTermTooLongAnswer(months);
  }

  if (months === 48 || /\b48\s*[-\s]?month|\b4\s*[-\s]?year\b/i.test(t)) {
    if (isQuestion(t) || /ok|fine|maximum|max/i.test(t)) {
      return {
        answer:
          "**48 months (4 years)** is our **maximum** allowed car loan term — that is acceptable. Shorter is fine too; do not go beyond 48.",
        preserveState: true,
      };
    }
  }

  if (/20\s*%\s*down|twenty\s+percent|how\s+much\s+down/i.test(t) && isQuestion(t)) {
    return {
      answer:
        "Put down **at least 20%** of the vehicle purchase price. That helps you avoid being **upside down** (owing more than the car’s value as it depreciates). Less than 20% is below our guideline.",
      preserveState: true,
    };
  }

  if (/10\s*%|ten\s+percent|transportation/i.test(t) && /income|afford|rule/i.test(t)) {
    return {
      answer:
        "Keep **total monthly transportation** — car payment + insurance + fuel + maintenance — at or below **10% of gross monthly income** (before taxes). Above that, the car is likely more than you should finance.",
      preserveState: true,
    };
  }

  if (/upside\s+down/i.test(t)) {
    return {
      answer:
        "Being **upside down** means you owe more on the loan than the car is worth. A **≥20% down payment** and a **≤48-month term** are how we reduce that risk. Avoid long loans on fast-depreciating vehicles.",
      preserveState: true,
    };
  }

  return null;
}

function answerMortgageDirect(text: string): DirectAnswer | null {
  const t = text.trim();

  if (/(?:what\s+are\s+(?:the\s+)?rules|your\s+rules)/i.test(t)) {
    return {
      answer:
        "Mortgage rules (fixed):\n\n" +
        "1) **Loan term:** **15- or 30-year** only.\n" +
        "2) **Refinance:** when the new rate is at least **1 percentage point** lower.\n" +
        "3) **Rate >5%:** pay off early when you can.\n" +
        "4) **Before buying:** **20% down + closing costs + emergency fund** in cash (else **keep renting**).\n" +
        "5) **Housing payment** (mortgage + tax + insurance + ~5–10% for HOA/repairs) must be **≤35% of gross monthly income**.\n\n" +
        "Share a purchase price (e.g. “500k”) and I’ll ask for income, down payment, rate, etc.",
      preserveState: true,
    };
  }

  if (/35\s*%|thirty[-\s]?five/i.test(t) && /income|housing|payment/i.test(t)) {
    return {
      answer:
        "Total monthly housing (principal & interest + property tax + insurance + HOA/maintenance hidden costs) must stay at or below **35% of gross monthly income**. Above that, we do **not** recommend buying.",
      preserveState: true,
    };
  }

  if (/\b(40|50)\s*[-\s]?year/i.test(t) || /\b(40|50)\s*[-\s]?year/i.test(t)) {
    return {
      answer:
        "We only use **15- or 30-year** mortgages here — not 40-year or other terms. Pick 15 if you can afford the payment (less interest); 30 if you need a lower payment.",
      preserveState: true,
    };
  }

  if (/\b15\s*[-\s]?year/i.test(t) && /\b30\s*[-\s]?year/i.test(t) && isQuestion(t)) {
    return {
      answer:
        "**15-year:** higher payment, much less interest, build equity faster.\n**30-year:** lower payment, more interest over time.\nBoth are allowed here — choose based on cash flow, but do not go outside 15/30.",
      preserveState: true,
    };
  }

  if (/refinanc|refi\b/i.test(t) && /1\s*%|one\s+percent|when\s+should/i.test(t)) {
    return {
      answer:
        "Refinance when the **new rate is at least 1 percentage point lower** than your current rate (e.g. 7% → 6% or better). Still confirm closing costs and how long you will keep the loan.",
      preserveState: true,
    };
  }

  if (
    /(?:pay\s+off|payoff|extra\s+principal|early)/i.test(t) &&
    /5\s*%|five\s+percent|high\s+rate/i.test(t)
  ) {
    return {
      answer:
        "If your mortgage rate is **above 5%**, we **strongly encourage paying off early** (extra principal whenever possible). Under 5%, extra payments are still helpful but the urgency is lower.",
      preserveState: true,
    };
  }

  if (/rent|ready\s+to\s+buy|should\s+i\s+buy/i.test(t) && /20\s*%|down\s+payment|closing/i.test(t)) {
    return {
      answer:
        "You need **20% down + closing costs + a funded emergency fund** (cash, not borrowed) before buying. If you do not have all three, **you are not ready — continue renting** until you do.",
      preserveState: true,
    };
  }

  return null;
}

function stepSummary(key: (typeof ORDER_OF_OPERATIONS)[number]["key"]): string {
  return ORDER_OF_OPERATIONS.find((o) => o.key === key)?.summary ?? "";
}

function answerInvestmentDirect(text: string): DirectAnswer | null {
  const t = text.trim();

  if (/(?:what\s+are\s+(?:the\s+)?rules|where\s+should\s+i\s+put|order\s+of|priority)/i.test(t)) {
    const lines = ORDER_OF_OPERATIONS.map((o) => `${o.step}. ${o.summary}`);
    return {
      answer:
        "Personal finance **priority order** in this section:\n\n" +
        lines.join("\n") +
        "\n\nSay how much you want to invest (e.g. “invest $10,000”) for step-by-step follow-ups, or ask about any step above.",
      preserveState: true,
    };
  }

  if (/401\s*k\s+match|employer\s+match/i.test(t)) {
    return {
      answer: stepSummary("MATCH_401K"),
      preserveState: true,
    };
  }

  if (/starter\s+emergency|~\s*\$?\s*2[,.]?000|2000\s+emergency/i.test(t)) {
    return {
      answer: stepSummary("STARTER_EMERGENCY"),
      preserveState: true,
    };
  }

  if (/high\s*interest\s+debt|credit\s+card|pay\s+debt\s+before/i.test(t)) {
    return {
      answer: stepSummary("DEBT_FIRST"),
      preserveState: true,
    };
  }

  if (/3\s*[-–]?\s*6\s+month|full\s+emergency|emergency\s+fund/i.test(t) && !/car|auto|vehicle/i.test(t)) {
    return {
      answer: stepSummary("FULL_EMERGENCY"),
      preserveState: true,
    };
  }

  if (/\bhsa\b|high\s+deductible|hdhp/i.test(t)) {
    return {
      answer: stepSummary("HSA_PRIORITY"),
      preserveState: true,
    };
  }

  if (/roth\s+ira|backdoor\s+roth/i.test(t)) {
    return {
      answer: stepSummary("ROTH_NEXT"),
      preserveState: true,
    };
  }

  if (/max\s+(?:out\s+)?401|401\s*k\s+limit|annual\s+limit/i.test(t)) {
    return {
      answer: stepSummary("MAX_RETIREMENT"),
      preserveState: true,
    };
  }

  if (/index\s+fund|brokerage|taxable\s+account|diversif/i.test(t)) {
    return {
      answer: stepSummary("BROKERAGE_INVESTING"),
      preserveState: true,
    };
  }

  return null;
}

/** Direct, rule-based answer when the user asks a clear question in-section. */
export function tryDirectSectionAnswer(
  text: string,
  topic: TopicId
): DirectAnswer | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  switch (topic) {
    case "car-loan":
      return answerCarLoanDirect(trimmed);
    case "mortgage":
      return answerMortgageDirect(trimmed);
    case "investment":
      return answerInvestmentDirect(trimmed);
  }
}

/**
 * After scope + direct answer: should we run the numbered intake flow?
 * False when the user asked a question — answer or decline first, never skip to “next field?”.
 */
export function shouldRunGuidedIntake(
  text: string,
  inActiveFlow: boolean
): boolean {
  if (isIntakeDataMessage(text, inActiveFlow)) return true;
  if (isUserAskingQuestion(text)) return false;
  return true;
}
