/**
 * Human conversation guardrails (all topics):
 * - Stay in scope and on rules — no random answers
 * - Don't repeat the same reply or checklist
 * - Sound like a person; one clarifying question when confused
 */

export type ChatMsg = { role: "user" | "assistant"; content: string };

export const CONVERSATION_RULES = {
  stayInSection: true,
  rulesAreFixed: true,
  noOffTopicGuessing: true,
  noRepeatSameReply: true,
  clarifyWhenConfused: true,
} as const;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function lastAssistantMessage(thread: ChatMsg[]): string | null {
  for (let i = thread.length - 1; i >= 0; i--) {
    if (thread[i].role === "assistant") return thread[i].content;
  }
  return null;
}

function similarityRatio(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length >= nb.length ? na : nb;
  if (longer.includes(shorter) && shorter.length / longer.length > 0.72) {
    return shorter.length / longer.length;
  }
  return 0;
}

export function isNearDuplicateReply(candidate: string, previous: string | null): boolean {
  if (!previous) return false;
  return similarityRatio(candidate, previous) >= 0.85;
}

function isAssessment(text: string): boolean {
  return /(?:checklist|assessment|overall:|mortgage assessment|car loan checklist)/i.test(
    text
  );
}

/** Drop a repeated "Got it — …" block if we already said the same summary. */
function stripDuplicateAck(candidate: string, previous: string | null): string {
  if (!previous) return candidate;
  const ack = candidate.match(/^Got it — [^\n]+\n\n/);
  if (!ack) return candidate;
  if (normalize(previous).includes(normalize(ack[0].trim()))) {
    return candidate.slice(ack[0].length).trimStart();
  }
  return candidate;
}

function rephraseRepeatedPrompt(previous: string, lastUser: string | null): string {
  const u = (lastUser ?? "").trim().toLowerCase();
  if (/cash on hand|down payment \+ closing/i.test(previous)) {
    if (/^(yes|yeah|yep|ok|okay)\.?$/i.test(u)) {
      return (
        "Thanks — I’m treating that as **yes**, you have enough cash set aside (not borrowed).\n\n" +
        "Moving on: what **mortgage interest rate** are you expecting? (e.g. 6.5%)"
      );
    }
    return (
      "I want to make sure I understand your cash situation.\n\n" +
      "For this home, you need cash for **down payment + closing + emergency fund** (separate buckets). " +
      "Do you have that full amount saved — **yes**, **no**, or tell me what you actually have (e.g. `$20,000`)?"
    );
  }
  if (/annual interest rate|APR/i.test(previous)) {
    return (
      "I still need your **interest rate (APR %)** for the loan — e.g. `6.5` or `6.5%`. " +
      "(That drives the monthly payment in the checklist.)"
    );
  }
  if (/gross monthly income/i.test(previous)) {
    return (
      "What’s your **gross monthly income** before taxes? (One number is fine — e.g. `$8,000` or `8k`.)"
    );
  }
  if (/loan term in months/i.test(previous)) {
    return (
      "What **loan term in months** are you considering? Remember our cap is **48 months** max for car loans."
    );
  }
  if (/put down|down payment/i.test(previous)) {
    return (
      "How much are you putting **down** in cash? If you’re not sure yet, say what you have and we can work from that."
    );
  }
  return (
    "I may not have caught that — can you rephrase, or tell me which number you want to change (price, down, income, rate)?"
  );
}

function assessmentRepeatFollowUp(previous: string, lastUser: string | null): string {
  if (/below|not meet|keep renting|✗/i.test(previous)) {
    return (
      "That’s still where the math lands with the numbers you gave. " +
      "If something should be different, tell me what to change (e.g. price, down payment, income, or rate) and I’ll rerun it."
    );
  }
  if (lastUser && /^(yes|no|ok)\.?$/i.test(lastUser.trim())) {
    return (
      "Got your note. If you want to tweak any inputs, say what to change; otherwise you can ask a specific rule question (e.g. “Is 72 months too long?”)."
    );
  }
  return (
    "Same result as before with these inputs. Change a number (price, down, income, term, rate) if you meant something different."
  );
}

/**
 * Last line of defense before sending text to the user.
 */
export function finalizeAssistantReply(
  thread: ChatMsg[],
  candidate: string
): string {
  let answer = candidate.trim();
  const previous = lastAssistantMessage(thread);
  const lastUser = [...thread].reverse().find((m) => m.role === "user")?.content ?? null;

  answer = stripDuplicateAck(answer, previous);

  if (!previous || !isNearDuplicateReply(answer, previous)) {
    return answer;
  }

  if (isAssessment(answer) && isAssessment(previous)) {
    return assessmentRepeatFollowUp(previous, lastUser);
  }

  return rephraseRepeatedPrompt(previous, lastUser);
}

/** Short intro for in-section chat (hub banners). */
export function sectionConversationHint(topic: "car-loan" | "mortgage" | "investment"): string {
  switch (topic) {
    case "car-loan":
      return "Ask a rule question anytime, or share your numbers in one message — I’ll only ask what’s missing.";
    case "mortgage":
      return "Share your situation in plain language; I’ll follow our mortgage rules and ask if something doesn’t add up.";
    case "investment":
      return "Tell me what you’re trying to do with your money — I’ll use our priority order, not generic internet advice.";
  }
}
