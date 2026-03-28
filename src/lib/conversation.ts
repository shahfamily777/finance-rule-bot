// Lightweight, deterministic conversational flow for the first few turns.
// Goal: If user says e.g. "I have 10k to invest", ask one question at a time:
// 1) Ask about high-interest debt (Yes/No). If Yes → advise payoff; if No →
// 2) Ask about 401(k) employer match (Yes/No). Then optionally outline plan.

export type Msg = { role: "user" | "assistant"; content: string };

function parseAmount(message: string): number | null {
  // Extract the first "money-like" amount.
  // Supports: "$19,000", "19000", "19k", "19 k", "19K", "1.5m".
  const cleaned = message.replace(/,/g, "");

  const m = cleaned.match(/\$?\s*(\d+(?:\.\d+)?)(?:\s*(k|m|b)\b)?/i);
  if (!m) return null;

  const base = Number(m[1]);
  if (!Number.isFinite(base)) return null;

  const suffix = (m[2] || "").toLowerCase();
  const multiplier = suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : suffix === "b" ? 1_000_000_000 : 1;

  return base * multiplier;
}

function mentionsInvest(message: string): boolean {
  return /(invest|put|save|stash|allocate|where should.*go)/i.test(message);
}

function parseYesNo(message: string): boolean | null {
  const m = message.trim().toLowerCase();
  if (["y", "yes", "yeah", "yep", "sure", "true"].includes(m)) return true;
  if (["n", "no", "nope", "false"].includes(m)) return false;
  // Heuristics for sentences
  if (/\b(yes|yeah|yep|correct|do)\b/i.test(m)) return true;
  if (/\b(no|nope|don\'t|do not|no debt|none)\b/i.test(m)) return false;
  return null;
}

function lastAssistant(thread: Msg[]): string | null {
  for (let i = thread.length - 1; i >= 0; i--) {
    if (thread[i].role === "assistant") return thread[i].content;
  }
  return null;
}

// Canonical prompts we look for in the last assistant turn so we know what was asked.
const ASK_DEBT_PROMPT = "do you have any high-interest debt";
const ASK_401K_PROMPT = "do you have a 401(k) (or similar) with an employer match";
const ASK_PLAN_PROMPT = "should i outline the step-by-step plan";
const ASK_DEBT_PLAN_PROMPT = "would you like a quick payoff plan";

export function handleConversationalFlow(thread: Msg[]): string | null {
  if (!Array.isArray(thread) || thread.length === 0) return null;

  const last = thread[thread.length - 1];
  const firstUser = thread.find((m) => m.role === "user");
  const lastAssistantText = lastAssistant(thread)?.toLowerCase() || "";

  // Case A: New thread that looks like an "invest $X" intent → start with debt question.
  if (
    thread.length <= 2 &&
    firstUser && firstUser.role === "user" &&
    mentionsInvest(firstUser.content) &&
    parseAmount(firstUser.content) !== null
  ) {
    // Only trigger if we haven't already asked the debt question.
    if (!lastAssistantText.includes(ASK_DEBT_PROMPT)) {
      const amt = parseAmount(firstUser.content)!;
      return `Got it—you’re looking to invest about $${amt.toLocaleString()}. Before we do that, do you have any high-interest debt (like credit cards or personal loans)? Yes or No`;
    }
  }

  // Case B: We just asked about debt → parse user's Yes/No and branch
  if (lastAssistantText.includes(ASK_DEBT_PROMPT)) {
    // The user's reply should be the last message
    if (last.role !== "user") return null;
    const yn = parseYesNo(last.content);
    if (yn === null) {
      return "Just to confirm—do you have any high-interest debt? Please answer Yes or No.";
    }
    if (yn) {
      // Has high-interest debt
      // Find original amount if available
      const amt = firstUser ? parseAmount(firstUser.content) : null;
      const amountText = amt ? `$${amt.toLocaleString()}` : "your available cash";
      return `Because high-interest debt typically costs more than conservative investment returns, your best guaranteed return is to pay that down first. I recommend using ${amountText} toward your highest-interest balance.\n\nWould you like a quick payoff plan (e.g., avalanche vs. snowball) and how to automate payments? Yes or No`;
    } else {
      // No high-interest debt → ask about 401k match
      return "Great. Do you have a 401(k) (or similar) with an employer match? Yes or No";
    }
  }

  // Case C: We just asked about 401k match → parse user's Yes/No
  if (lastAssistantText.includes(ASK_401K_PROMPT)) {
    if (last.role !== "user") return null;
    const yn = parseYesNo(last.content);
    if (yn === null) {
      return "Do you get an employer match on a 401(k) or similar? Yes or No";
    }
    const amt = firstUser ? parseAmount(firstUser.content) : null;
    if (yn) {
      return "Nice—capturing the full employer match is typically the best first move. We’ll allocate enough to get the full match, then discuss the next best place for the rest (e.g., IRA, brokerage). Would you like me to outline that step-by-step? Yes or No";
    } else {
      return "No problem—then we’ll look at IRA options and/or a taxable brokerage. Want me to outline a simple allocation and next steps? Yes or No";
    }
  }

  // Case D: We just offered to outline the plan (401k path)
  if (lastAssistantText.includes(ASK_PLAN_PROMPT)) {
    if (last.role !== "user") return null;
    const yn = parseYesNo(last.content);
    if (yn === null) return "Should I outline the step-by-step investment plan? Yes or No";
    if (yn) {
      const amt = firstUser ? parseAmount(firstUser.content) : null;
      const amountText = amt ? `$${amt.toLocaleString()}` : "your funds";
      // We don't know whether they answered yes/no to match here; we can still provide a generic ordered plan.
      return (
        `Plan for ${amountText}:\n` +
        "1) Contribute enough to your 401(k) to capture the full employer match (if offered).\n" +
        "2) Fund an IRA (Roth or Traditional depending on eligibility and taxes).\n" +
        "3) Put the remainder in a diversified low-cost index fund portfolio in a brokerage account.\n" +
        "Ask me anytime to tailor this by timeline and risk tolerance."
      );
    } else {
      return "Okay—whenever you want the step-by-step plan, say “show plan.”";
    }
  }

  // Case E: We just offered a debt payoff plan
  if (lastAssistantText.includes(ASK_DEBT_PLAN_PROMPT)) {
    if (last.role !== "user") return null;
    const yn = parseYesNo(last.content);
    if (yn === null) return "Would you like a quick debt payoff plan? Yes or No";
    if (yn) {
      return "Okay—roughly how much do you owe and at what interest rates? You can list like: “$6k at 24%, $2.5k at 18%.”";
    } else {
      return "No problem. When the high-interest debt is paid off, we can build your investment plan next. Just say “ready to invest.”";
    }
  }

  // Otherwise, fall back to model behavior
  return null;
}
