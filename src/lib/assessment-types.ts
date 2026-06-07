export type AssessmentStatus = "on_track" | "needs_attention" | "not_ready";

export type AssessmentFinding = {
  label: string;
  detail: string;
  pass?: boolean;
};

/** A positive financial behavior, with a calm explanation of WHY it matters. */
export type AssessmentWin = {
  label: string;
  detail: string;
};

export type StructuredAssessment = {
  title: string;
  status: AssessmentStatus;
  statusHeadline: string;
  summary: string;
  /** What the user is already doing well — shown first. */
  wins: AssessmentWin[];
  /** Things worth improving. */
  watchAreas: AssessmentFinding[];
  /** Neutral context numbers (payment, price) — not a win or a concern. */
  context?: AssessmentFinding[];
  /** Heading for the context block (defaults to "Your numbers"). */
  contextTitle?: string;
  /** Single highest-priority action. */
  recommendedNextStep: string | null;
};

export function formatAssessmentAnswer(a: StructuredAssessment): string {
  const statusLine =
    a.status === "on_track"
      ? "On track"
      : a.status === "needs_attention"
        ? "Needs attention"
        : "Not ready yet";

  const wins = a.wins ?? [];
  const watchAreas = a.watchAreas ?? [];
  const context = a.context ?? [];

  const lines: string[] = [
    a.title,
    "",
    `Overall: ${statusLine} — ${a.statusHeadline}`,
    "",
    a.summary,
  ];

  if (wins.length > 0) {
    lines.push("", "Financial wins:");
    wins.forEach((w) => lines.push(`✓ ${w.label}: ${w.detail}`));
  }

  if (watchAreas.length > 0) {
    lines.push("", "Watch areas:");
    watchAreas.forEach((f) => lines.push(`• ${f.label}: ${f.detail}`));
  }

  if (context.length > 0) {
    lines.push("", `${a.contextTitle ?? "Your numbers"}:`);
    context.forEach((f) => lines.push(`• ${f.label}: ${f.detail}`));
  }

  if (a.recommendedNextStep) {
    lines.push("", "Recommended next step:", a.recommendedNextStep);
  }

  return lines.join("\n");
}
