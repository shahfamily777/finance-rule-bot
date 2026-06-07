"use client";

import type { StructuredAssessment } from "@/lib/assessment-types";
import type { SectionTheme } from "@/lib/section-theme";

function statusStyles(status: StructuredAssessment["status"]) {
  switch (status) {
    case "on_track":
      return "bg-emerald-50 text-emerald-900 border-emerald-200";
    case "needs_attention":
      return "bg-amber-50 text-amber-900 border-amber-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
}

function statusLabel(status: StructuredAssessment["status"]) {
  switch (status) {
    case "on_track":
      return "On track";
    case "needs_attention":
      return "Needs attention";
    default:
      return "Not ready yet";
  }
}

export function AssessmentView({
  assessment,
  theme,
  onExploreRules,
  onUpdateNumbers,
}: {
  assessment: StructuredAssessment;
  theme: SectionTheme;
  onExploreRules: () => void;
  onUpdateNumbers: () => void;
}) {
  const wins = assessment.wins ?? [];
  const watchAreas = assessment.watchAreas ?? [];
  const context = assessment.context ?? [];

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Your assessment
        </p>
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          {assessment.title}
        </h2>
        <div
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles(assessment.status)}`}
        >
          {statusLabel(assessment.status)} — {assessment.statusHeadline}
        </div>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-800">Overall financial status</h3>
        <p className="text-[15px] leading-relaxed text-slate-600">{assessment.summary}</p>
      </section>

      {wins.length > 0 ? (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <span aria-hidden>✓</span> Financial wins
          </h3>
          <ul className="space-y-2.5">
            {wins.map((w, i) => (
              <li
                key={`${w.label}-${i}`}
                className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm shadow-sm"
              >
                <span className="flex items-start gap-2 font-semibold text-emerald-900">
                  <span className="mt-0.5 text-emerald-600" aria-hidden>
                    ✓
                  </span>
                  {w.label}
                </span>
                <p className="mt-1 pl-6 leading-relaxed text-emerald-800/90">
                  {w.detail}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {watchAreas.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Watch areas</h3>
          <ul className="space-y-2.5">
            {watchAreas.map((f, i) => (
              <li
                key={`${f.label}-${i}`}
                className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm shadow-sm"
              >
                <span className="flex items-start gap-2 font-semibold text-amber-900">
                  <span className="mt-0.5 text-amber-500" aria-hidden>
                    !
                  </span>
                  {f.label}
                </span>
                <p className="mt-1 pl-6 leading-relaxed text-amber-900/80">
                  {f.detail}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {context.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">
            {assessment.contextTitle ?? "Your numbers"}
          </h3>
          <ul className="space-y-1.5">
            {context.map((f, i) => (
              <li
                key={`${f.label}-${i}`}
                className="flex flex-col gap-0.5 text-sm sm:flex-row sm:gap-2"
              >
                <span className="font-medium text-slate-700">{f.label}:</span>
                <span className="text-slate-600">{f.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {assessment.recommendedNextStep ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">Recommended next step</h3>
          <div
            className={`rounded-xl border px-4 py-4 text-sm leading-relaxed ${theme.shell.accentLight}`}
          >
            {assessment.recommendedNextStep}
          </div>
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-slate-500">
        Rule-based educational guidance. Not financial advice.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onExploreRules}
          className={`rounded-xl px-5 py-3.5 text-sm font-bold text-white transition ${theme.chat.sendBtn}`}
        >
          Explore the rules
        </button>
        <button
          type="button"
          onClick={onUpdateNumbers}
          className="rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Update your numbers
        </button>
      </div>
    </div>
  );
}
