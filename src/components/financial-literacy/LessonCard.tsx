"use client";

import { CompoundGrowthVisual } from "@/components/financial-literacy/CompoundGrowthVisual";
import { QuizBlock } from "@/components/financial-literacy/QuizBlock";
import { markTopicCompleted } from "@/lib/financial-literacy/progress";
import type { FinancialLiteracyTopic } from "@/lib/specs/types";

const ACCENT_LIGHT = "bg-violet-50 text-violet-900 border-violet-100";

export function LessonCard({
  topic,
  completed,
  onBack,
  onCompleted,
}: {
  topic: FinancialLiteracyTopic;
  completed: boolean;
  onBack: () => void;
  onCompleted: (topicId: string) => void;
}) {
  function finishWithoutQuiz() {
    markTopicCompleted(topic.id);
    onCompleted(topic.id);
  }

  function finishWithQuiz() {
    markTopicCompleted(topic.id);
    onCompleted(topic.id);
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <span aria-hidden>←</span> All topics
      </button>

      {completed ? (
        <p className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          <span aria-hidden>✓</span> Completed
        </p>
      ) : null}

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Concept
        </p>
        <h3 className="text-xl font-semibold text-slate-900">
          {topic.emoji} {topic.concept}
        </h3>
      </div>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-800">Simple explanation</h4>
        <p className="text-[15px] leading-relaxed text-slate-600 whitespace-pre-line">
          {topic.explanation.trim()}
        </p>
      </section>

      <section className={`space-y-2 rounded-xl border px-4 py-4 ${ACCENT_LIGHT}`}>
        <h4 className="text-sm font-semibold">Example</h4>
        <p className="text-[15px] leading-relaxed whitespace-pre-line">
          {topic.example.trim()}
        </p>
      </section>

      {topic.visual?.scenarios ? (
        <CompoundGrowthVisual scenarios={topic.visual.scenarios} />
      ) : null}

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-800">Key takeaway</h4>
        <p className="text-[15px] leading-relaxed text-slate-600 whitespace-pre-line">
          {topic.takeaway.trim()}
        </p>
      </section>

      {topic.quiz ? (
        <QuizBlock quiz={topic.quiz} onComplete={finishWithQuiz} />
      ) : (
        <button
          type="button"
          onClick={finishWithoutQuiz}
          className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Mark topic complete
        </button>
      )}
    </div>
  );
}
