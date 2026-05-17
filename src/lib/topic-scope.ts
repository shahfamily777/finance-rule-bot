import {
  relatesToCarLoanSection,
  relatesToInvestmentSection,
  relatesToMortgageSection,
  type TopicId,
} from "@/lib/section-qa";

export type { TopicId };

export type ScopeReject = {
  message: string;
  preserveState?: boolean;
};

const SECTION_NAMES: Record<TopicId, string> = {
  "car-loan": "Car loan",
  mortgage: "Mortgage",
  investment: "Investment (personal finance)",
};

function mentionsMortgage(text: string): boolean {
  if (/(car|auto|vehicle|suv|truck)/i.test(text)) return false;
  return /(mortgage|home\s+loan|house\s+loan|\bpmi\b|refinanc\w*\s+(?:my\s+)?home|buy(?:ing)?\s+a\s+house|home\s+purchase|down\s+payment\s+on\s+(?:a\s+)?house|property\s+tax|escrow)/i.test(
    text
  );
}

function mentionsCarLoan(text: string): boolean {
  return /(car\s+loan|auto\s+loan|vehicle\s+loan|financ(?:e|ing)\s+a\s+car|buy(?:ing)?\s+a\s+car|new\s+car|used\s+car|auto\s+insurance|car\s+note|car\s+payment|transportation\s+(?:cost|expense)|vehicle\s+price|car\s+price)/i.test(
    text
  );
}

function mentionsInvestmentFinance(text: string): boolean {
  if (mentionsCarLoan(text) || mentionsMortgage(text)) return false;
  const q = text.toLowerCase();
  const keys = [
    "invest",
    "401k",
    "403b",
    "roth",
    "ira",
    "hsa",
    "emergency fund",
    "retirement",
    "index fund",
    "portfolio",
    "stock",
    "bond",
    "bonus",
    "allocate",
    "savings",
    "debt",
    "credit card",
    "high-interest",
  ];
  return keys.some((k) => q.includes(k));
}

/** Short numeric / yes-no replies while answering guided follow-ups. */
function looksLikeFlowAnswer(text: string): boolean {
  const t = text.trim();
  if (/^(y|yes|no|nope|yeah|n|ok|okay)\.?$/i.test(t)) return true;
  if (/^\$?[\d,]+(?:\.\d+)?(?:\s*(?:k|m|b))?\s*(?:months?|years?)?\.?$/i.test(t)) return true;
  if (/\d+\s*(?:month|year)/i.test(t) && t.length < 80) return true;
  return false;
}

function isClearlyOffTopic(text: string): boolean {
  const q = text.toLowerCase();
  const offTopic = [
    "weather",
    "recipe",
    "sports",
    "movie",
    "joke",
    "poem",
    "homework",
    "python code",
    "javascript",
    "medical",
    "legal advice",
    "dating",
    "politics",
  ];
  return offTopic.some((k) => q.includes(k));
}

function relatesToCurrentSection(text: string, topic: TopicId): boolean {
  switch (topic) {
    case "car-loan":
      return relatesToCarLoanSection(text);
    case "mortgage":
      return relatesToMortgageSection(text);
    case "investment":
      return relatesToInvestmentSection(text);
  }
}

/**
 * Returns a rejection only for wrong-section or truly off-topic messages.
 * Rule-related questions in the active section are allowed (answered directly or via flow).
 */
export function checkTopicScope(
  text: string,
  currentTopic: TopicId,
  options?: { inActiveFlow?: boolean }
): ScopeReject | null {
  const inFlow = options?.inActiveFlow ?? false;
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (inFlow && looksLikeFlowAnswer(trimmed)) return null;

  if (relatesToCurrentSection(trimmed, currentTopic)) return null;

  if (currentTopic === "car-loan") {
    if (mentionsMortgage(trimmed)) {
      return {
        message: `That question is about **${SECTION_NAMES.mortgage}**, not car loans. Go back to **All topics** and open **${SECTION_NAMES.mortgage}**.\n\nThis section covers auto financing only (20% down, max 48-month term, ≤10% transportation).`,
        preserveState: true,
      };
    }
    if (mentionsInvestmentFinance(trimmed)) {
      return {
        message: `That is a **personal finance / investment** question. Go back to **All topics** and open **${SECTION_NAMES.investment}**.\n\nThis section is for **car loan** rules and eligibility only.`,
        preserveState: true,
      };
    }
    if (isClearlyOffTopic(trimmed)) {
      return {
        message:
          "We do not answer that here.\n\nThis app only supports **Car loan**, **Mortgage**, and **Investment**. Pick the right section from **All topics**.",
        preserveState: true,
      };
    }
    return {
      message:
        "That does not look like a **car loan** question.\n\nYou can ask about loan term (max **48 months**), **20% down**, transportation budget (**10%** of income), or share your numbers. For **mortgage** or **other finance**, use **All topics**.",
      preserveState: true,
    };
  }

  if (currentTopic === "mortgage") {
    if (mentionsCarLoan(trimmed) && !mentionsMortgage(trimmed)) {
      return {
        message: `That belongs in **${SECTION_NAMES["car-loan"]}**. Open **All topics** → **Car loan**.`,
        preserveState: true,
      };
    }
    if (mentionsInvestmentFinance(trimmed)) {
      return {
        message: `That belongs in **${SECTION_NAMES.investment}**. Open **All topics** → **Investment**.`,
        preserveState: true,
      };
    }
    if (isClearlyOffTopic(trimmed)) {
      return {
        message:
          "We do not answer that. Use **Car loan**, **Mortgage**, or **Investment** from **All topics**.",
        preserveState: true,
      };
    }
    return {
      message:
        "That does not look like a **mortgage** question.\n\nAsk about 15/30-year terms, refinance (1% rate drop), readiness to buy (20% down + closing + emergency fund), or rates above 5%. For **car loans** or **investing**, use **All topics**.",
      preserveState: true,
    };
  }

  // investment
  if (mentionsCarLoan(trimmed) && !mentionsInvestmentFinance(trimmed)) {
    return {
      message: `That belongs in **${SECTION_NAMES["car-loan"]}**. Open **All topics** → **Car loan**.`,
      preserveState: true,
    };
  }
  if (mentionsMortgage(trimmed)) {
    return {
      message: `That belongs in **${SECTION_NAMES.mortgage}**. Open **All topics** → **Mortgage**.`,
      preserveState: true,
    };
  }
  if (isClearlyOffTopic(trimmed)) {
    return {
      message:
        "We do not answer that. This app only covers **Car loan**, **Mortgage**, and **Investment**.",
      preserveState: true,
    };
  }
  return {
    message:
      "That does not look like a **personal finance** question.\n\nAsk about saving, debt, retirement, or investing — or use **All topics** for **Car loan** / **Mortgage**.",
    preserveState: true,
  };
}
