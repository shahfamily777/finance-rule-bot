/**
 * Universal intake policy for Finance Rules Bot:
 *
 * 1. Parse ALL fields the user gave (in one message or across the thread).
 * 2. Never re-ask for a field that is already filled.
 * 3. Ask only the next missing field, or run the assessment if enough is known.
 * 4. Acknowledge what was understood when the user provided several numbers at once.
 */

export function parseAmountToken(raw: string): number | null {
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

const AMOUNT = String.raw`([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)`;

/** Dollar/k amount immediately BEFORE a label: "50k car cost", "40k down" */
export function amountBeforeLabel(text: string, labelPattern: string): number | null {
  const re = new RegExp(`${AMOUNT}\\s*(?:\\/\\s*mo(?:nth)?)?\\s*${labelPattern}`, "i");
  const m = text.match(re);
  return m?.[1] ? parseAmountToken(m[1]) : null;
}

/** Amount immediately AFTER a label: "down payment 40k", "salary 6000" */
export function amountAfterLabel(text: string, labelPattern: string): number | null {
  const re = new RegExp(`${labelPattern}\\s*(?:is\\s+|of\\s+)?\\$?\\s*${AMOUNT}`, "i");
  const m = text.match(re);
  return m?.[1] ? parseAmountToken(m[1]) : null;
}

export function labeledAmount(
  text: string,
  opts: { before?: string[]; after?: string[] }
): number | null {
  for (const p of opts.before ?? []) {
    const n = amountBeforeLabel(text, p);
    if (n !== null) return n;
  }
  for (const p of opts.after ?? []) {
    const n = amountAfterLabel(text, p);
    if (n !== null) return n;
  }
  return null;
}

/** Gross monthly income / salary (before taxes). */
export function parseGrossMonthlyIncome(text: string): number | null {
  return (
    labeledAmount(text, {
      before: [
        String.raw`(?:gross\s+)?(?:monthly\s+)?(?:salary|income|pay|wages)`,
        String.raw`(?:monthly\s+)?(?:salary|income|pay)`,
      ],
      after: [
        String.raw`(?:gross\s+)?(?:monthly\s+)?(?:salary|income|pay|wages)`,
        String.raw`(?:monthly\s+)?(?:salary|income)`,
      ],
    }) ??
    amountBeforeLabel(text, String.raw`(?:per\s+month|\/\s*mo(?:nth)?)\b`) ??
    firstMatchAmount(
      text,
      /(?:earn|make|bring\s+home)\s*(?:about\s+)?\$?\s*([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)/i
    )
  );
}

function firstMatchAmount(text: string, pattern: RegExp): number | null {
  const m = text.match(pattern);
  return m?.[1] ? parseAmountToken(m[1]) : null;
}

/** APR / mortgage rate — prefers "5% loan", "6.5% apr"; skips "20% down". */
export function parseAprPercent(text: string): number | null {
  const loanPct = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:loan|apr|interest(?:\s+rate)?|rate)\b/i);
  if (loanPct) {
    const n = Number(loanPct[1]);
    if (n > 0 && n <= 30) return n;
  }
  const after = text.match(
    /(?:apr|interest\s+rate|mortgage\s+rate|rate)\s*(?:of\s+|is\s+|at\s+)?(\d+(?:\.\d+)?)\s*%?/i
  );
  if (after) {
    const n = Number(after[1]);
    if (n > 0 && n <= 30) return n;
  }
  const pct = text.match(/(\d+(?:\.\d+)?)\s*%/i);
  if (pct) {
    const window = text.slice(
      Math.max(0, (pct.index ?? 0) - 12),
      (pct.index ?? 0) + (pct[0]?.length ?? 0) + 12
    );
    if (!/\bdown\b/i.test(window)) {
      const n = Number(pct[1]);
      if (n > 0 && n <= 30) return n;
    }
  }
  return null;
}

/** Down payment dollars: "40k down", "down 40k", "down payment $40,000" */
export function parseDownPaymentAmount(text: string, homePrice: number | null): number | null {
  const dollars =
    amountBeforeLabel(text, String.raw`down\b`) ??
    amountAfterLabel(text, String.raw`down\s*(?:payment|payment)?`) ??
    labeledAmount(text, { after: [String.raw`down\s*(?:payment)?`] });

  if (dollars !== null) return dollars;

  const pct = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:down|downpayment)/i);
  if (pct && homePrice !== null) {
    return (homePrice * Number(pct[1])) / 100;
  }
  return null;
}

/** Vehicle / home price from natural phrasing. */
export function parsePurchasePrice(
  text: string,
  kind: "car" | "home"
): number | null {
  const carLabels =
    kind === "car"
      ? [
          String.raw`(?:car|vehicle|auto)\s*(?:cost|price|is)`,
          String.raw`(?:cost|price)\s+of\s+(?:the\s+)?(?:car|vehicle)`,
        ]
      : [
          String.raw`(?:home|house)\s*(?:cost|price|is)`,
          String.raw`(?:purchase\s*price|asking\s*price)`,
        ];

  const before =
    kind === "car"
      ? [String.raw`(?:car|vehicle|auto)\s*(?:cost|price)`]
      : [String.raw`(?:home|house)\s*(?:cost|price|is)`, String.raw`(?:purchase|asking)\s*price`];

  const noun =
    kind === "car"
      ? amountBeforeLabel(text, String.raw`(?:car|vehicle|auto)\b`)
      : amountBeforeLabel(text, String.raw`(?:home|house)\b`);

  return (
    labeledAmount(text, { before, after: carLabels }) ??
    noun ??
    (/\d+\s*k\b/i.test(text) ? parseFirstMoneyInText(text) : null)
  );
}

function parseFirstMoneyInText(text: string): number | null {
  const m = text.match(/\$?\s*([\d,]+(?:\.\d+)?\s*(?:k|m|b)?)/i);
  return m ? parseAmountToken(m[0]) : null;
}

/** Join non-empty acknowledgment fragments. */
export function intakeAcknowledgment(parts: string[]): string {
  const clean = parts.filter(Boolean);
  if (clean.length === 0) return "";
  return `Got it — ${clean.join(", ")}.\n\n`;
}

/** True when the message looks like a bundle of numbers, not a single yes/no. */
export function looksLikeBulkIntake(text: string): boolean {
  const amounts = text.match(/\d[\d,]*(?:\.\d+)?\s*(?:k|m|b)?/gi);
  return (amounts?.length ?? 0) >= 2 || (amounts?.length === 1 && /,/.test(text));
}

export function parseYesNo(message: string): boolean | null {
  const m = message.trim().toLowerCase();
  if (["y", "yes", "yeah", "yep", "sure", "true", "ok", "okay"].includes(m)) return true;
  if (["n", "no", "nope", "false"].includes(m)) return false;
  if (/\b(i\s+do|i\s+have|i\s+have enough|yes|yeah|yep|correct|affirmative)\b/i.test(m)) {
    return true;
  }
  if (/\b(i\s+don'?t|i\s+do\s+not|i\s+dont|no|nope|not enough|can\'?t)\b/i.test(m)) {
    return false;
  }
  return null;
}

/** Short income reply (e.g. "30k", "30000") when not a rate or term. */
export function parseIncomeShortReply(text: string): number | null {
  if (/%/.test(text) || /\bmonths?\b/i.test(text) || /\byears?\b/i.test(text)) return null;
  const trimmed = text.trim();
  if (!/^[\d$,.\s]+(?:k|m|b)?$/i.test(trimmed)) return null;
  const amt = parseAmountToken(trimmed);
  if (amt === null || amt < 500 || amt > 2_000_000) return null;
  return amt;
}
