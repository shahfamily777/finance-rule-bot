"use client";

import { AssessmentView } from "@/components/AssessmentView";
import type { BigPurchaseAssessmentResult } from "@/lib/big-purchase-assess";
import type { SectionTheme } from "@/lib/section-theme";

const BIG_PURCHASE_THEME: SectionTheme = {
  id: "investment",
  label: "Big Purchase",
  emoji: "🛍️",
  hub: {
    gradient: "bg-gradient-to-br from-rose-700 to-orange-900",
    iconBg: "bg-white/15",
    iconColor: "text-white",
    border: "border-rose-200/60",
    shadow: "shadow-lg shadow-rose-500/20",
    hoverShadow: "hover:shadow-xl hover:shadow-rose-500/30",
  },
  shell: {
    headerGradient: "bg-gradient-to-r from-rose-700 to-orange-800",
    accent: "text-rose-700",
    accentLight: "bg-rose-50 text-rose-900 border-rose-200",
    ring: "ring-rose-500/30 focus-visible:ring-rose-500",
    choiceActive: "border-rose-600 bg-rose-50 text-rose-900 ring-2 ring-rose-500/20",
  },
  chat: {
    userBubble:
      "bg-gradient-to-br from-rose-700 to-orange-800 text-white shadow-md shadow-rose-500/25",
    assistantBubble:
      "bg-white/95 text-slate-800 border border-slate-200 shadow-sm ring-1 ring-slate-50",
    composerBg: "bg-gradient-to-t from-rose-50/90 to-white/80",
    sendBtn:
      "bg-gradient-to-r from-rose-700 to-orange-800 hover:from-rose-600 hover:to-orange-700 shadow-lg shadow-rose-500/30",
    sendBtnDisabled: "bg-slate-200 text-slate-400 shadow-none",
  },
  submitBtn:
    "bg-gradient-to-r from-rose-700 to-orange-800 hover:from-rose-600 hover:to-orange-700 shadow-lg shadow-rose-500/25",
};

function categoryBadgeStyles(category: BigPurchaseAssessmentResult["category"]) {
  switch (category) {
    case "comfortable":
      return "bg-emerald-50 text-emerald-900 border-emerald-200";
    case "stretch":
      return "bg-amber-50 text-amber-900 border-amber-200";
    default:
      return "bg-orange-50 text-orange-900 border-orange-200";
  }
}

export function BigPurchaseResultsView({
  result,
  onExploreRules,
  onUpdateNumbers,
}: {
  result: BigPurchaseAssessmentResult;
  onBack: () => void;
  onExploreRules: () => void;
  onUpdateNumbers: () => void;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Decision category
        </p>
        <div
          className={`inline-flex flex-col rounded-xl border px-4 py-3 ${categoryBadgeStyles(result.category)}`}
        >
          <span className="text-lg font-semibold">{result.categoryLabel}</span>
          <span className="mt-0.5 text-sm font-medium opacity-90">
            {result.categoryHeadline}
          </span>
        </div>
        <p className="text-[15px] leading-relaxed text-slate-600">
          {result.categoryDescription}
        </p>
      </div>

      <AssessmentView
        assessment={result.assessment}
        theme={BIG_PURCHASE_THEME}
        onExploreRules={onExploreRules}
        onUpdateNumbers={onUpdateNumbers}
      />

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Long-term impact</h3>
        <p className="text-sm text-slate-600">
          Before and after this purchase — based on the numbers you entered.
        </p>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-3 gap-0 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Metric</span>
            <span className="text-center">Before</span>
            <span className="text-center">After</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {result.longTermImpact.map((row) => (
              <li key={row.label} className="px-4 py-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                  <span className="text-sm font-medium text-slate-800">{row.label}</span>
                  <span className="text-sm text-slate-600 sm:text-center">{row.before}</span>
                  <span className="text-sm font-medium text-slate-800 sm:text-center">
                    {row.after}
                  </span>
                </div>
                {row.note ? (
                  <p className="mt-1 text-xs text-slate-500">{row.note}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {result.opportunityCost.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Opportunity cost</h3>
          <p className="text-sm text-slate-600">
            Objective tradeoffs to consider — not recommendations about what to do.
          </p>
          <ul className="space-y-2.5">
            {result.opportunityCost.map((item) => (
              <li
                key={item.label}
                className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm shadow-sm"
              >
                <span className="font-semibold text-slate-800">{item.label}</span>
                <p className="mt-1 leading-relaxed text-slate-600">{item.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Reflection questions</h3>
        <p className="text-sm text-slate-600">
          Take a moment to think through these — there is no right or wrong answer.
        </p>
        <ul className="space-y-2">
          {result.reflectionQuestions.map((q) => (
            <li
              key={q}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700"
            >
              {q}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
