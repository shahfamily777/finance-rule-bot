"use client";

import {
  getSnowballAvalancheContent,
  recommendPayoffMethod,
  type PayoffPreference,
} from "@/lib/debt-snowball-avalanche";
import { useState } from "react";

const ACCENT_LIGHT = "bg-slate-50 text-slate-900 border-slate-200";

export function SnowballAvalancheView({ onBack }: { onBack: () => void }) {
  const { snowball, avalanche, comparison } = getSnowballAvalancheContent();
  const [preference, setPreference] = useState<PayoffPreference | null>(null);

  const recommendation = preference ? recommendPayoffMethod(preference) : null;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">{snowball.name}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{snowball.description}</p>
          <h4 className="mt-4 text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Benefits
          </h4>
          <ul className="mt-2 space-y-1.5">
            {snowball.benefits.map((b) => (
              <li key={b} className="flex gap-2 text-sm text-slate-600">
                <span className="text-emerald-500" aria-hidden>
                  ✓
                </span>
                {b}
              </li>
            ))}
          </ul>
          <h4 className="mt-4 text-xs font-semibold uppercase tracking-wider text-amber-700">
            Drawbacks
          </h4>
          <ul className="mt-2 space-y-1.5">
            {snowball.drawbacks.map((d) => (
              <li key={d} className="flex gap-2 text-sm text-slate-600">
                <span className="text-amber-500" aria-hidden>
                  !
                </span>
                {d}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">{avalanche.name}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{avalanche.description}</p>
          <h4 className="mt-4 text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Benefits
          </h4>
          <ul className="mt-2 space-y-1.5">
            {avalanche.benefits.map((b) => (
              <li key={b} className="flex gap-2 text-sm text-slate-600">
                <span className="text-emerald-500" aria-hidden>
                  ✓
                </span>
                {b}
              </li>
            ))}
          </ul>
          <h4 className="mt-4 text-xs font-semibold uppercase tracking-wider text-amber-700">
            Drawbacks
          </h4>
          <ul className="mt-2 space-y-1.5">
            {avalanche.drawbacks.map((d) => (
              <li key={d} className="flex gap-2 text-sm text-slate-600">
                <span className="text-amber-500" aria-hidden>
                  !
                </span>
                {d}
              </li>
            ))}
          </ul>
        </article>
      </div>

      <section className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[320px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 font-semibold text-slate-700">Factor</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Snowball</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Avalanche</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((row) => (
              <tr key={row.dimension} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-800">{row.dimension}</td>
                <td className="px-4 py-3 text-slate-600">{row.snowball}</td>
                <td className="px-4 py-3 text-slate-600">{row.avalanche}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-4">
        <h3 className="text-base font-semibold text-slate-900">Which method fits me?</h3>
        <p className="text-sm text-slate-600">
          Pick the statement that sounds more like you — we&apos;ll recommend a method.
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setPreference("motivation")}
            className={`rounded-xl border-2 px-4 py-4 text-left text-sm font-semibold transition ${
              preference === "motivation"
                ? "border-slate-600 bg-slate-50 text-slate-900 ring-2 ring-slate-500/20"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            I prefer motivation and quick wins
          </button>
          <button
            type="button"
            onClick={() => setPreference("minimize_interest")}
            className={`rounded-xl border-2 px-4 py-4 text-left text-sm font-semibold transition ${
              preference === "minimize_interest"
                ? "border-slate-600 bg-slate-50 text-slate-900 ring-2 ring-slate-500/20"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            I want to minimize total interest
          </button>
        </div>

        {recommendation ? (
          <div className={`rounded-xl border px-4 py-4 ${ACCENT_LIGHT}`}>
            <h4 className="text-sm font-semibold">{recommendation.headline}</h4>
            <p className="mt-2 text-sm leading-relaxed">{recommendation.reasoning}</p>
            <p className="mt-2 text-xs font-medium text-slate-500">
              Recommended method: {recommendation.methodName}
            </p>
          </div>
        ) : null}
      </section>

      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <span aria-hidden>←</span> All sections
      </button>
    </div>
  );
}
