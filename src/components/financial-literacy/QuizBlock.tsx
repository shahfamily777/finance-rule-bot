"use client";

import { evaluateQuizAnswer } from "@/lib/financial-literacy/quiz";
import type { FinancialLiteracyQuiz } from "@/lib/specs/types";
import { useState } from "react";

const HEADER_GRADIENT = "bg-gradient-to-r from-violet-600 to-indigo-600";

export function QuizBlock({
  quiz,
  onComplete,
}: {
  quiz: FinancialLiteracyQuiz;
  onComplete: () => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);

  function choose(index: number) {
    if (answered) return;
    setSelectedIndex(index);
    setAnswered(true);
  }

  const result =
    selectedIndex !== null ? evaluateQuizAnswer(quiz, selectedIndex) : null;

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-slate-800">Quick quiz</h3>
      <p className="text-[15px] font-medium leading-relaxed text-slate-900">
        {quiz.question}
      </p>

      <div className="flex flex-col gap-2.5">
        {quiz.options.map((option, index) => {
          const isSelected = selectedIndex === index;
          const isCorrect = index === quiz.correctIndex;
          let style =
            "border-slate-200 bg-white text-slate-700 hover:border-slate-300";

          if (answered && isSelected && isCorrect) {
            style = "border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20";
          } else if (answered && isSelected && !isCorrect) {
            style = "border-amber-400 bg-amber-50 text-amber-900 ring-2 ring-amber-400/20";
          } else if (answered && !isSelected && isCorrect) {
            style = "border-emerald-300 bg-emerald-50/60 text-emerald-800";
          } else if (answered) {
            style = "border-slate-100 bg-slate-50 text-slate-500";
          }

          return (
            <button
              key={index}
              type="button"
              disabled={answered}
              onClick={() => choose(index)}
              className={`rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition ${style} disabled:cursor-default`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {result ? (
        <div
          className={`space-y-2 rounded-xl border px-4 py-3 ${
            result.correct
              ? "border-emerald-200 bg-emerald-50/80"
              : "border-amber-200 bg-amber-50/80"
          }`}
        >
          <p className="text-sm font-semibold text-slate-900">
            {result.correct ? "That's the idea." : "Good try — here's the reasoning."}
          </p>
          <p className="text-sm leading-relaxed text-slate-700">{result.explanation}</p>
        </div>
      ) : null}

      {answered ? (
        <button
          type="button"
          onClick={onComplete}
          className={`w-full rounded-xl px-5 py-3 text-sm font-bold text-white transition sm:w-auto ${HEADER_GRADIENT} shadow-md shadow-violet-500/20 hover:opacity-95`}
        >
          Mark topic complete
        </button>
      ) : null}
    </section>
  );
}
