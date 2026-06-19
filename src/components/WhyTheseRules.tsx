"use client";

import { WHY_RULES, type RuleExplanation } from "@/lib/why-rules";
import { useState } from "react";

function RuleCard({ rule }: { rule: RuleExplanation }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="overflow-hidden rounded-xl border border-slate-200 bg-white/80 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-slate-900">{rule.rule}</span>
        <span
          className={`mt-0.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3 text-sm">
          <Detail label="Why the rule exists" text={rule.why} />
          <Detail label="Source" text={rule.source} />
          <Detail label="Assumptions" text={rule.assumptions} />
          <Detail label="Alternative viewpoints" text={rule.alternativeViewpoints} />
        </div>
      ) : null}
    </li>
  );
}

function Detail({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 leading-relaxed text-slate-700">{text}</p>
    </div>
  );
}

export function WhyTheseRules() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Transparency
        </p>
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Why these rules?
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600">
          Every assessment in this app comes from fixed rules — no AI guessing. Here&apos;s
          the reasoning behind each one: why it exists, where it comes from, the assumptions
          it makes, and honest alternative views. Tap any rule to expand it.
        </p>
      </div>

      {WHY_RULES.map((group) => (
        <section key={group.id} className="space-y-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {group.emoji} {group.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{group.intro}</p>
          </div>
          <ul className="space-y-2.5">
            {group.rules.map((rule) => (
              <RuleCard key={rule.id} rule={rule} />
            ))}
          </ul>
        </section>
      ))}

      <p className="text-xs leading-relaxed text-slate-500">
        Rule-based educational guidance. Not financial advice. These rules are intentionally
        conservative defaults — your situation may justify a different choice.
      </p>
    </div>
  );
}
