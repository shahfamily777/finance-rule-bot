"use client";

import { LessonCard } from "@/components/financial-literacy/LessonCard";
import {
  FINANCIAL_LITERACY,
  getFinancialLiteracyTopics,
} from "@/lib/financial-literacy";
import {
  getCompletedTopics,
  getCompletionCount,
} from "@/lib/financial-literacy/progress";
import { useCallback, useEffect, useState } from "react";

const HEADER_GRADIENT = "bg-gradient-to-r from-violet-600 to-indigo-600";

export function FinancialLiteracyModule() {
  const topics = getFinancialLiteracyTopics();
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  const refreshProgress = useCallback(() => {
    setCompletedIds(getCompletedTopics());
  }, []);

  useEffect(() => {
    refreshProgress();
  }, [refreshProgress]);

  const { completed, total } = getCompletionCount(topics.length);
  const activeTopic = activeTopicId
    ? topics.find((t) => t.id === activeTopicId) ?? null
    : null;

  function handleCompleted(_topicId: string) {
    refreshProgress();
    setActiveTopicId(null);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/80 shadow-lg shadow-slate-200/40 backdrop-blur-md">
      <div className={`${HEADER_GRADIENT} px-5 py-5 sm:px-7`}>
        <p className="text-xs font-medium uppercase tracking-wider text-white/75">
          {FINANCIAL_LITERACY.meta.label}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">
          {activeTopic ? `${activeTopic.emoji} ${activeTopic.title}` : FINANCIAL_LITERACY.meta.label}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-white/85">
          {activeTopic
            ? activeTopic.tagline
            : FINANCIAL_LITERACY.meta.blurb}
        </p>
      </div>

      <div className="p-6 sm:p-8">
        {!activeTopic ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">
                  {completed} of {total} topics completed
                </span>
                <span className="text-xs text-slate-500">
                  {Math.round((completed / total) * 100)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`${HEADER_GRADIENT} h-full rounded-full transition-all duration-500`}
                  style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
                />
              </div>
            </div>

            <p className="text-[15px] leading-relaxed text-slate-600">
              {FINANCIAL_LITERACY.meta.hub_intro.trim()}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {topics.map((t) => {
                const done = completedIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTopicId(t.id)}
                    className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-violet-300 hover:shadow-md"
                  >
                    <span className="flex items-center gap-2 text-base font-semibold text-slate-900">
                      <span>{t.emoji}</span>
                      {t.title}
                      {done ? (
                        <span className="ml-auto text-xs font-medium text-emerald-600">
                          ✓ Done
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 text-sm text-slate-500">{t.tagline}</span>
                  </button>
                );
              })}
            </div>

            <p className="text-xs leading-relaxed text-slate-500">
              {FINANCIAL_LITERACY.disclaimer}
            </p>
          </div>
        ) : (
          <LessonCard
            topic={activeTopic}
            completed={completedIds.includes(activeTopic.id)}
            onBack={() => setActiveTopicId(null)}
            onCompleted={handleCompleted}
          />
        )}
      </div>
    </div>
  );
}
