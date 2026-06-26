"use client";

import { AssessmentView } from "@/components/AssessmentView";
import { CostlyMistakesModule } from "@/components/CostlyMistakesModule";
import { BigPurchaseModule } from "@/components/big-purchase/BigPurchaseModule";
import { DebtModule } from "@/components/debt/DebtModule";
import { FinancialLiteracyModule } from "@/components/financial-literacy/FinancialLiteracyModule";
import { GuidedChat } from "@/components/GuidedChat";
import { SectionGuidedIntake } from "@/components/SectionGuidedIntake";
import { StartHere, type StartHereDestination } from "@/components/StartHere";
import { WhyTheseRules } from "@/components/WhyTheseRules";
import {
  assessmentFromChatState,
  isIntakeComplete,
} from "@/lib/assessment-from-state";
import type { StructuredAssessment } from "@/lib/assessment-types";
import type { GuidedPrompt } from "@/lib/guided-prompts";
import { getSectionTheme, SECTION_THEMES } from "@/lib/section-theme";
import { trackClick } from "@/lib/track-click";
import type {
  CarLoanFormValues,
  InvestmentFormValues,
  MortgageFormValues,
} from "@/lib/form-types";
import { useCallback, useEffect, useRef, useState } from "react";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type SectionId = "car-loan" | "mortgage" | "investment";

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const SECTIONS: {
  id: SectionId;
  label: string;
  blurb: string;
}[] = [
  {
    id: "car-loan",
    label: "Car Loan",
    blurb: "Can I afford this car?",
  },
  {
    id: "mortgage",
    label: "Mortgage",
    blurb: "Can I afford this house?",
  },
  {
    id: "investment",
    label: "Money Priority Plan",
    blurb: "Where your next dollar should go",
  },
];

/**
 * Homepage hub is fully config-driven. Active cards link to a live section via
 * `openSection`; `coming-soon` cards are purely presentational (badge + disabled).
 * To re-enable a Coming Soon item, swap its entry back to a `section` item — the
 * underlying feature code/routes are left untouched.
 */
type HubItem =
  | { kind: "section"; id: SectionId; title: string; blurb: string }
  | {
      kind: "view";
      view: "costly-mistakes" | "debt" | "financial-literacy" | "big-purchase";
      emoji: string;
      title: string;
      blurb: string;
    };

type HubGroupConfig = {
  title: string;
  description: string;
  items: HubItem[];
};

const HUB_GROUPS: HubGroupConfig[] = [
  {
    title: "Build Wealth",
    description: "Grow wealth intentionally.",
    items: [
      {
        kind: "section",
        id: "investment",
        title: "Invest",
        blurb: "Where your next dollar should go",
      },
      {
        kind: "view",
        view: "debt",
        emoji: "💳",
        title: "Debt",
        blurb: "Help prioritize debt payoff and understand debt decisions.",
      },
    ],
  },
  {
    title: "Major Decisions",
    description: "Evaluate major purchases.",
    items: [
      {
        kind: "section",
        id: "mortgage",
        title: "Mortgage",
        blurb: "Can I afford this house?",
      },
      {
        kind: "section",
        id: "car-loan",
        title: "Car Loan",
        blurb: "Can I afford this car?",
      },
      {
        kind: "view",
        view: "big-purchase",
        emoji: "🛍️",
        title: "Big Purchase Decisions",
        blurb: "Evaluate major financial commitments before making them.",
      },
    ],
  },
  {
    title: "Learn",
    description: "Avoid costly mistakes.",
    items: [
      {
        kind: "view",
        view: "financial-literacy",
        emoji: "📚",
        title: "Financial Literacy",
        blurb: "Learn the money concepts that matter most",
      },
      {
        kind: "view",
        view: "costly-mistakes",
        emoji: "🛡️",
        title: "Avoid Costly Mistakes",
        blurb: "Understand big decisions before committing",
      },
    ],
  },
];

/**
 * Calm, desaturated card palette — deep professional tones with white text.
 * Kept local to the hub so the in-section theming (section-theme.ts) is untouched.
 */
const CARD_BODY: Record<SectionId, string> = {
  investment: "bg-gradient-to-br from-indigo-800 to-indigo-950",
  mortgage: "bg-gradient-to-br from-teal-700 to-teal-900",
  "car-loan": "bg-gradient-to-br from-sky-700 to-blue-900",
};

const COSTLY_MISTAKES_BODY = "bg-gradient-to-br from-amber-700 to-amber-900";
const DEBT_BODY = "bg-gradient-to-br from-slate-700 to-stone-900";
const FINANCIAL_LITERACY_BODY = "bg-gradient-to-br from-violet-700 to-indigo-900";
const BIG_PURCHASE_BODY = "bg-gradient-to-br from-rose-700 to-orange-900";

/** Shared card chrome so every primary card matches in width, height, and padding. */
const CARD_BASE =
  "hub-card group relative flex min-h-[12.5rem] flex-col overflow-hidden rounded-2xl border border-slate-200/70 p-0 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500";

const CARD_BODY_INNER = "flex flex-1 flex-col px-6 py-6 text-white";

const CARD_ICON =
  "mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-white";

const CARD_FOOTER =
  "flex items-center justify-between border-t border-slate-100 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition-colors group-hover:text-slate-900";

function IconCar({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 13h16l-1-4H5l-1 4z" />
      <path d="M6 13v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2" />
      <circle cx="7.5" cy="17" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="17" r="1.5" fill="currentColor" stroke="none" />
      <path d="M3 13l2-5h14l2 5" />
    </svg>
  );
}

function IconHome({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 10v9h14v-9" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

function IconChart({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 19h16" />
      <path d="M7 16V9" />
      <path d="M12 16v-5" />
      <path d="M17 16V7" />
    </svg>
  );
}

function sectionIcon(id: SectionId, className: string) {
  switch (id) {
    case "car-loan":
      return <IconCar className={className} />;
    case "mortgage":
      return <IconHome className={className} />;
    default:
      return <IconChart className={className} />;
  }
}

/** Parse /api/chat JSON or Vercel/Next error bodies; never show a useless generic "Request failed". */
function extractAssistantText(raw: string, res: Response): string {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (typeof data.answer === "string" && data.answer.length > 0) {
      return data.answer;
    }
    if (typeof data.error === "string" && data.error.length > 0) {
      return data.error;
    }
    const nested = data.error;
    if (nested && typeof nested === "object" && nested !== null) {
      const m = (nested as { message?: unknown }).message;
      if (typeof m === "string" && m.length > 0) return m;
    }
    if (typeof data.message === "string" && data.message.length > 0) {
      return data.message;
    }
  } catch {
    /* not JSON */
  }

  const snippet = raw.replace(/\s+/g, " ").trim().slice(0, 400);
  if (snippet.length > 0) {
    return `HTTP ${res.status} ${res.statusText}: ${snippet}`;
  }
  return `HTTP ${res.status} ${res.statusText || "Error"} — no response body. If you just added OPENAI_API_KEY on Vercel, redeploy the project.`;
}

const EMPTY_MESSAGES: Record<SectionId, ChatMessage[]> = {
  "car-loan": [],
  mortgage: [],
  investment: [],
};

const EMPTY_STATE: Record<SectionId, unknown> = {
  "car-loan": null,
  mortgage: null,
  investment: null,
};

type Phase = "guided" | "assessment" | "chat";

const EMPTY_PHASE: Record<SectionId, Phase> = {
  "car-loan": "guided",
  mortgage: "guided",
  investment: "guided",
};

function initialPhaseForSection(
  section: SectionId,
  state: unknown,
  assessment: StructuredAssessment | null
): Phase {
  if (!isIntakeComplete(state)) return "guided";
  return assessment ? "assessment" : "chat";
}

function phaseSubtitle(phase: Phase): string {
  if (phase === "guided") return "Guided questions";
  if (phase === "assessment") return "Your assessment";
  return "Explore the rules";
}

function HubGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 px-1">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          {description}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

type View = "hub" | SectionId | "costly-mistakes" | "debt" | "financial-literacy" | "big-purchase" | "start-here" | "why-rules";

export default function Home() {
  const [view, setView] = useState<View>("hub");
  const [startHereComingSoon, setStartHereComingSoon] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messagesBySection, setMessagesBySection] =
    useState<Record<SectionId, ChatMessage[]>>(EMPTY_MESSAGES);
  const [chatStateBySection, setChatStateBySection] =
    useState<Record<SectionId, unknown>>(EMPTY_STATE);
  const [phaseBySection, setPhaseBySection] =
    useState<Record<SectionId, Phase>>(EMPTY_PHASE);
  const [loading, setLoading] = useState(false);
  const [formSanityError, setFormSanityError] = useState<
    Record<SectionId, string | null>
  >({
    "car-loan": null,
    mortgage: null,
    investment: null,
  });
  const [assessmentBySection, setAssessmentBySection] = useState<
    Record<SectionId, StructuredAssessment | null>
  >({
    "car-loan": null,
    mortgage: null,
    investment: null,
  });
  const [freeChatBySection, setFreeChatBySection] = useState<
    Record<SectionId, boolean>
  >({
    "car-loan": false,
    mortgage: false,
    investment: false,
  });
  const [resetCounter, setResetCounter] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const section: SectionId | null =
    view === "hub" ||
    view === "costly-mistakes" ||
    view === "debt" ||
    view === "financial-literacy" ||
    view === "big-purchase" ||
    view === "start-here" ||
    view === "why-rules"
      ? null
      : view;
  const messages = section ? messagesBySection[section] : [];
  const phase = section ? phaseBySection[section] : "guided";
  const assessment: StructuredAssessment | null = section
    ? assessmentBySection[section] ??
      assessmentFromChatState(section, chatStateBySection[section])
    : null;
  const freeChat = section ? freeChatBySection[section] : false;
  const chatState = section ? chatStateBySection[section] : null;

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, view, scrollToBottom]);

  async function submitForm(
    form: CarLoanFormValues | MortgageFormValues | InvestmentFormValues,
    options?: { sanityAcknowledged?: boolean }
  ) {
    if (!section) return;
    setFormSanityError((prev) => ({ ...prev, [section]: null }));
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: "submit-form",
          topic: section,
          form,
          sanityAcknowledged: options?.sanityAcknowledged ?? false,
        }),
      });
      const raw = await res.text();
      const data = JSON.parse(raw) as {
        answer?: string;
        state?: unknown;
        assessment?: StructuredAssessment;
      };
      if ("state" in data) {
        setChatStateBySection((prev) => ({
          ...prev,
          [section]: data.state ?? null,
        }));
      }
      const reply = extractAssistantText(raw, res);
      if (!res.ok) {
        setFormSanityError((prev) => ({ ...prev, [section]: reply }));
        return;
      }
      const structured =
        data.assessment ??
        assessmentFromChatState(section, data.state) ??
        null;
      if (structured) {
        setAssessmentBySection((prev) => ({ ...prev, [section]: structured }));
      }
      setMessagesBySection((prev) => ({ ...prev, [section]: [] }));
      setFreeChatBySection((prev) => ({ ...prev, [section]: false }));
      setPhaseBySection((prev) => ({ ...prev, [section]: "assessment" }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setMessagesBySection((prev) => ({
        ...prev,
        [section]: [
          {
            id: newId(),
            role: "assistant",
            content: `Could not run assessment: ${msg}`,
          },
        ],
      }));
    } finally {
      setLoading(false);
    }
  }

  function openFormToEditNumbers() {
    if (!section) return;
    setFormSanityError((prev) => ({ ...prev, [section]: null }));
    setPhaseBySection((prev) => ({ ...prev, [section]: "guided" }));
  }

  function openGuidedChat() {
    if (!section) return;
    setPhaseBySection((prev) => ({ ...prev, [section]: "chat" }));
    setFreeChatBySection((prev) => ({ ...prev, [section]: false }));
  }

  function resetSection(id: SectionId) {
    setChatStateBySection((prev) => ({ ...prev, [id]: null }));
    setAssessmentBySection((prev) => ({ ...prev, [id]: null }));
    setMessagesBySection((prev) => ({ ...prev, [id]: [] }));
    setFreeChatBySection((prev) => ({ ...prev, [id]: false }));
    setFormSanityError((prev) => ({ ...prev, [id]: null }));
    setPhaseBySection((prev) => ({ ...prev, [id]: "guided" }));
    setResetCounter((n) => n + 1);
  }

  function openSection(id: SectionId) {
    trackClick(id, { event: "section_open", label: `section:${id}` });
    setView(id);
    setFormSanityError((prev) => ({ ...prev, [id]: null }));
    const a =
      assessmentBySection[id] ??
      assessmentFromChatState(id, chatStateBySection[id]);
    if (a && !assessmentBySection[id]) {
      setAssessmentBySection((prev) => ({ ...prev, [id]: a }));
    }
    setPhaseBySection((prev) => ({
      ...prev,
      [id]: initialPhaseForSection(id, chatStateBySection[id], a),
    }));
  }

  function handleStartHerePick(destination: StartHereDestination) {
    if (destination.kind === "section") {
      setStartHereComingSoon(null);
      openSection(destination.id);
      return;
    }
    if (destination.kind === "view") {
      setStartHereComingSoon(null);
      trackClick(destination.view, {
        event: "section_open",
        label: `section:${destination.view}`,
      });
      setView(destination.view);
      return;
    }
    trackClick("start-here", {
      event: "start_here_coming_soon",
      label: `coming-soon:${destination.title}`,
    });
    setStartHereComingSoon(destination.title);
  }

  function renderSectionCard(id: SectionId, title: string, blurb: string) {
    const t = SECTION_THEMES[id];
    return (
      <button
        key={id}
        type="button"
        onClick={() => openSection(id)}
        className={CARD_BASE}
      >
        <div className={`${CARD_BODY[id]} ${CARD_BODY_INNER}`}>
          <div className={CARD_ICON}>{sectionIcon(id, "h-6 w-6")}</div>
          <h3 className="text-lg font-semibold tracking-tight">
            {t.emoji} {title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-white/80">{blurb}</p>
        </div>
        <div className={CARD_FOOTER}>
          <span>Get Started</span>
          <span
            className="transition-transform duration-300 group-hover:translate-x-1"
            aria-hidden
          >
            →
          </span>
        </div>
      </button>
    );
  }

  function renderViewCard(
    targetView: "costly-mistakes" | "debt" | "financial-literacy" | "big-purchase",
    emoji: string,
    title: string,
    blurb: string
  ) {
    const bodyClass =
      targetView === "debt"
        ? DEBT_BODY
        : targetView === "financial-literacy"
          ? FINANCIAL_LITERACY_BODY
          : targetView === "big-purchase"
            ? BIG_PURCHASE_BODY
            : COSTLY_MISTAKES_BODY;
    return (
      <button
        key={targetView}
        type="button"
        onClick={() => {
          trackClick(targetView, {
            event: "section_open",
            label: `section:${targetView}`,
          });
          setStartHereComingSoon(null);
          setView(targetView);
        }}
        className={CARD_BASE}
      >
        <div className={`${bodyClass} ${CARD_BODY_INNER}`}>
          <div className={`${CARD_ICON} text-2xl`}>{emoji}</div>
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-white/80">{blurb}</p>
        </div>
        <div className={CARD_FOOTER}>
          <span>Get Started</span>
          <span
            className="transition-transform duration-300 group-hover:translate-x-1"
            aria-hidden
          >
            →
          </span>
        </div>
      </button>
    );
  }

  async function sendPrompt(prompt: GuidedPrompt) {
    if (!section || phase !== "chat") return;
    setInput("");
    const userMsg: ChatMessage = { id: newId(), role: "user", content: prompt.message };
    setMessagesBySection((prev) => ({
      ...prev,
      [section]: [...prev[section], userMsg],
    }));
    setLoading(true);
    const threadPayload = [...messagesBySection[section], userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          messages: threadPayload,
          state: chatStateBySection[section],
          topic: section,
        }),
      });
      const raw = await res.text();
      try {
        const data = JSON.parse(raw) as { state?: unknown };
        if ("state" in data) {
          setChatStateBySection((prev) => ({
            ...prev,
            [section]: data.state ?? null,
          }));
        }
      } catch {
        /* ignore */
      }
      const reply = extractAssistantText(raw, res);
      setMessagesBySection((prev) => ({
        ...prev,
        [section]: [...prev[section], { id: newId(), role: "assistant", content: reply }],
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setMessagesBySection((prev) => ({
        ...prev,
        [section]: [
          ...prev[section],
          { id: newId(), role: "assistant", content: `Could not reach the server: ${msg}` },
        ],
      }));
    } finally {
      setLoading(false);
    }
  }

  async function sendQuestion() {
    if (!section || phase !== "chat") return;
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    const userMsg: ChatMessage = { id: newId(), role: "user", content: text };
    setMessagesBySection((prev) => ({
      ...prev,
      [section]: [...prev[section], userMsg],
    }));
    setLoading(true);

    const threadSoFar = [...messagesBySection[section], userMsg];
    const threadPayload = threadSoFar.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          messages: threadPayload,
          state: chatStateBySection[section],
          topic: section,
        }),
      });

      const raw = await res.text();

      try {
        const data = JSON.parse(raw) as { state?: unknown };
        if ("state" in data) {
          setChatStateBySection((prev) => ({
            ...prev,
            [section]: data.state ?? null,
          }));
        }
      } catch {
        // ignore
      }

      const reply = extractAssistantText(raw, res);

      setMessagesBySection((prev) => ({
        ...prev,
        [section]: [
          ...prev[section],
          { id: newId(), role: "assistant", content: reply },
        ],
      }));
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : "Something went wrong.";
      setMessagesBySection((prev) => ({
        ...prev,
        [section]: [
          ...prev[section],
          {
            id: newId(),
            role: "assistant",
            content: `Could not reach the server: ${msg}. Check your connection and that the site finished deploying.`,
          },
        ],
      }));
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendQuestion();
    }
  }

  const activeMeta =
    view !== "hub" ? SECTIONS.find((s) => s.id === view) : null;
  const theme = section ? getSectionTheme(section) : null;

  return (
    <div className="app-bg relative min-h-screen overflow-x-hidden">
      <div
        className="pointer-events-none fixed inset-0 bg-gradient-to-b from-white/40 via-transparent to-white/60"
        aria-hidden
      />
      <main className="relative mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-10 pt-8 sm:px-6 sm:pt-12">
        <header className="mb-10 text-center">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Personal finance guidance
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Finance Rules
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-slate-600">
            Make calmer and clearer money decisions.
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
            Spend intentionally.
            <br />
            Avoid costly mistakes.
            <br />
            Build wealth through simple decisions.
          </p>
        </header>

        {view === "hub" ? (
          <div className="space-y-10">
            <button
              type="button"
              onClick={() => {
                trackClick("start-here", {
                  event: "section_open",
                  label: "section:start-here",
                });
                setStartHereComingSoon(null);
                setView("start-here");
              }}
              className="hub-card group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-indigo-900/20 bg-gradient-to-br from-indigo-700 to-violet-900 px-6 py-6 text-left text-white shadow-md shadow-indigo-900/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-2xl">
                🧭
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold tracking-tight">
                  Not sure where to begin?
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-white/80">
                  Answer a few quick questions and get pointed to the most
                  relevant financial decision tool.
                </span>
              </span>
              <span
                className="ml-auto text-xl text-white/90 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden
              >
                →
              </span>
            </button>

            {HUB_GROUPS.map((group) => (
              <HubGroup
                key={group.title}
                title={group.title}
                description={group.description}
              >
                {group.items.map((item) =>
                  item.kind === "section"
                    ? renderSectionCard(item.id, item.title, item.blurb)
                    : renderViewCard(item.view, item.emoji, item.title, item.blurb)
                )}
              </HubGroup>
            ))}

            <section className="rounded-2xl border border-slate-200/70 bg-white/70 p-6 backdrop-blur-sm">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                Why Finance Rules?
              </h2>
              <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-600">
                {[
                  "Structured assessments instead of generic chatbot answers",
                  "Transparent rules and reasoning",
                  "No financial products to sell",
                  "Designed to help people make better decisions",
                ].map((point) => (
                  <li key={point} className="flex gap-2.5">
                    <span className="mt-0.5 shrink-0 font-bold text-teal-600" aria-hidden>
                      ✓
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : view === "costly-mistakes" ? (
          <>
            <div className="mb-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setView("hub")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm font-medium text-slate-800 shadow-sm backdrop-blur-sm transition hover:bg-white hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                <span aria-hidden>←</span> All topics
              </button>
            </div>
            <CostlyMistakesModule />
          </>
        ) : view === "debt" ? (
          <>
            <div className="mb-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setView("hub")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm font-medium text-slate-800 shadow-sm backdrop-blur-sm transition hover:bg-white hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                <span aria-hidden>←</span> All topics
              </button>
            </div>
            <DebtModule />
          </>
        ) : view === "financial-literacy" ? (
          <>
            <div className="mb-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setView("hub")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm font-medium text-slate-800 shadow-sm backdrop-blur-sm transition hover:bg-white hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                <span aria-hidden>←</span> All topics
              </button>
            </div>
            <FinancialLiteracyModule />
          </>
        ) : view === "big-purchase" ? (
          <>
            <div className="mb-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setView("hub")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm font-medium text-slate-800 shadow-sm backdrop-blur-sm transition hover:bg-white hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                <span aria-hidden>←</span> All topics
              </button>
            </div>
            <BigPurchaseModule />
          </>
        ) : view === "start-here" ? (
          <>
            <div className="mb-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setView("hub")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm font-medium text-slate-800 shadow-sm backdrop-blur-sm transition hover:bg-white hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                <span aria-hidden>←</span> All topics
              </button>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/80 p-6 shadow-lg shadow-slate-200/30 backdrop-blur-md sm:p-8">
              <StartHere
                onPick={handleStartHerePick}
                comingSoonTitle={startHereComingSoon}
              />
            </div>
          </>
        ) : view === "why-rules" ? (
          <>
            <div className="mb-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setView("hub")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm font-medium text-slate-800 shadow-sm backdrop-blur-sm transition hover:bg-white hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                <span aria-hidden>←</span> All topics
              </button>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/80 p-6 shadow-lg shadow-slate-200/30 backdrop-blur-md sm:p-8">
              <WhyTheseRules />
            </div>
          </>
        ) : (
          <>
            <div className="mb-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setView("hub")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm font-medium text-slate-800 shadow-sm backdrop-blur-sm transition hover:bg-white hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                <span aria-hidden>←</span> All topics
              </button>
              {activeMeta && theme && (
                <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/80 bg-white/70 px-3 py-2 shadow-sm backdrop-blur-sm">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${theme.shell.headerGradient}`}
                  >
                    {sectionIcon(activeMeta.id, "h-5 w-5")}
                  </span>
                  <div className="min-w-0 text-left">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {theme.emoji} {activeMeta.label}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {phaseSubtitle(phase)}
                    </p>
                  </div>
                </div>
              )}
              {section && (Boolean(chatState) || phase !== "guided") ? (
                <button
                  type="button"
                  onClick={() => resetSection(section)}
                  className="shrink-0 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-slate-900 hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                  title="Clear this section and start a new check"
                >
                  Start over
                </button>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/80 bg-white/80 shadow-lg shadow-slate-200/30 backdrop-blur-md">
              {phase === "guided" && section ? (
                <div className="p-4 sm:p-5">
                  <SectionGuidedIntake
                    key={`${section}-${resetCounter}`}
                    section={section}
                    chatState={chatState}
                    sanityError={formSanityError[section]}
                    onClearSanityError={() =>
                      setFormSanityError((prev) => ({ ...prev, [section]: null }))
                    }
                    onSubmit={(form, options) => void submitForm(form, options)}
                    loading={loading}
                  />
                </div>
              ) : null}

              {phase === "assessment" && theme && assessment && section ? (
                <div className="chat-scroll min-h-[min(420px,55vh)] flex-1 overflow-y-auto p-6 sm:p-8">
                  <AssessmentView
                    assessment={assessment}
                    theme={theme}
                    onExploreRules={openGuidedChat}
                    onUpdateNumbers={openFormToEditNumbers}
                  />
                </div>
              ) : null}

              {phase === "chat" && theme && section ? (
                <GuidedChat
                  section={section}
                  theme={theme}
                  messages={messages}
                  loading={loading}
                  freeMode={freeChat}
                  onPrompt={(p) => void sendPrompt(p)}
                  onEnableFreeMode={() =>
                    setFreeChatBySection((prev) => ({ ...prev, [section]: true }))
                  }
                  onUpdateNumbers={openFormToEditNumbers}
                  input={input}
                  onInputChange={setInput}
                  onSend={() => void sendQuestion()}
                  onKeyDown={onKeyDown}
                />
              ) : null}

              <div ref={bottomRef} />
            </div>
          </>
        )}
        <footer className="mt-12 space-y-2 text-center text-xs text-slate-500">
          {view !== "why-rules" ? (
            <p>
              <button
                type="button"
                onClick={() => {
                  trackClick("why-rules", {
                    event: "section_open",
                    label: "section:why-rules",
                  });
                  setView("why-rules");
                }}
                className="font-semibold text-indigo-600 underline-offset-2 hover:text-indigo-700 hover:underline"
              >
                Why these rules?
              </button>
            </p>
          ) : null}
          <p>Rule-based educational guidance. Not financial advice.</p>
        </footer>
      </main>
    </div>
  );
}
