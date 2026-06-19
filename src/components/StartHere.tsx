"use client";

import type { SectionId } from "@/lib/section-theme";

export type StartHereDestination =
  | { kind: "section"; id: SectionId }
  | { kind: "coming-soon"; title: string };

type Option = {
  id: string;
  emoji: string;
  label: string;
  sub: string;
  destination: StartHereDestination;
};

const OPTIONS: Option[] = [
  {
    id: "debt",
    emoji: "💳",
    label: "Pay off debt",
    sub: "Tackle credit cards or loans in the right order",
    destination: { kind: "coming-soon", title: "Debt" },
  },
  {
    id: "invest",
    emoji: "📈",
    label: "Invest / build wealth",
    sub: "Figure out where your next dollar should go",
    destination: { kind: "section", id: "investment" },
  },
  {
    id: "home",
    emoji: "🏠",
    label: "Buy or refinance a home",
    sub: "Check if you're ready and what you can afford",
    destination: { kind: "section", id: "mortgage" },
  },
  {
    id: "car",
    emoji: "🚗",
    label: "Buy a car",
    sub: "See if the loan fits your budget",
    destination: { kind: "section", id: "car-loan" },
  },
  {
    id: "purchase",
    emoji: "🛍️",
    label: "Make a big purchase decision",
    sub: "A quick sanity check before you buy",
    destination: { kind: "coming-soon", title: "Can I Buy This?" },
  },
];

export function StartHere({
  onPick,
  comingSoonTitle,
}: {
  onPick: (destination: StartHereDestination) => void;
  comingSoonTitle: string | null;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Start here
        </p>
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          What&apos;s on your mind right now?
        </h2>
        <p className="text-[15px] leading-relaxed text-slate-600">
          Pick what you&apos;re working on and we&apos;ll guide you to the right section.
        </p>
      </div>

      <ul className="space-y-2.5">
        {OPTIONS.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => onPick(o.destination)}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
                {o.emoji}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">
                  {o.label}
                </span>
                <span className="block text-xs text-slate-500">{o.sub}</span>
              </span>
              <span className="ml-auto text-slate-300" aria-hidden>
                →
              </span>
            </button>
          </li>
        ))}
      </ul>

      {comingSoonTitle ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
          <strong>{comingSoonTitle}</strong> is coming soon. In the meantime, explore one of
          the available sections above.
        </div>
      ) : null}
    </div>
  );
}
