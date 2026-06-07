"use client";

import { FormError } from "@/components/intake-fields";
import { getGuidedInsight } from "@/lib/guided-insights";
import type { SectionId } from "@/lib/section-theme";
import { INTAKE_SUBMIT_BASE } from "@/lib/section-theme";
import { useFormTheme } from "@/components/FormThemeContext";

export function GuidedStepShell({
  section,
  stepIndex,
  stepTotal,
  stepId,
  title,
  subtitle,
  children,
  error,
  onBack,
  onNext,
  nextLabel = "Continue",
  loading,
  isFirst,
  isLast,
}: {
  section: SectionId;
  stepIndex: number;
  stepTotal: number;
  stepId: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  error?: string | null;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  loading?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const theme = useFormTheme();
  const insight = getGuidedInsight(section, stepId);
  const pct = Math.round((stepIndex / stepTotal) * 100);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
          <span>
            Step {stepIndex} of {stepTotal}
          </span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={stepIndex}
          aria-valuemin={1}
          aria-valuemax={stepTotal}
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${theme.shell.headerGradient}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          {title}
        </h3>
        {subtitle ? (
          <p className="text-sm leading-relaxed text-slate-600">{subtitle}</p>
        ) : null}
      </div>

      {insight ? (
        <p
          className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${theme.shell.accentLight}`}
        >
          <span className="font-medium">Tip — </span>
          {insight.text}
        </p>
      ) : null}

      <div className="space-y-4">{children}</div>

      {error ? <FormError message={error} /> : null}

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
        {!isFirst && onBack ? (
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Back
          </button>
        ) : (
          <span className="hidden sm:block" />
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={loading}
          className={`${INTAKE_SUBMIT_BASE} sm:min-w-[10rem] ${theme.submitBtn} ${!isFirst ? "sm:ml-auto" : "w-full"}`}
        >
          {loading ? "Working…" : isLast ? "See my assessment" : nextLabel}
        </button>
      </div>
    </div>
  );
}
