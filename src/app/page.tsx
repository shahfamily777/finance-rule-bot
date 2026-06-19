"use client";

import { AssessmentView } from "@/components/AssessmentView";
import { CostlyMistakesModule } from "@/components/CostlyMistakesModule";
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
  | { kind: "view"; view: "costly-mistakes"; emoji: string; title: string; blurb: string }
  | { kind: "coming-soon"; emoji: string; title: string; blurb: string };

type HubGroupConfig = {
  title: string;
  description: string;
  items: HubItem[];
};

const HUB_GROUPS: HubGroupConfig[] = [
  {
    title: "Build Wealth",
    description: "Create a strong financial foundation and grow wealth intentionally.",
    items: [
      {
        kind: "section",
        id: "investment",
        title: "Invest",
        blurb: "Where your next dollar should go",
      },
    ],
  },
  {
    title: "Major Decisions",
    description: "Evaluate major purchases before making long-term commitments.",
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
    ],
  },
  {
    title: "Learn",
    description: "Understand financial concepts and avoid expensive mistakes.",
    items: [
      {
        kind: "view",
        view: "costly-mistakes",
        emoji: "🛡️",
        title: "Avoid Costly Mistakes",
        blurb: "Understand big decisions before committing",
      },
    ],
  },
  {
    title: "Coming soon",
    description: "Not available yet — we're still building these.",
    items: [
      {
        kind: "coming-soon",
        emoji: "💳",
        title: "Debt",
        blurb: "Pay it down in the right order",
      },
      {
        kind: "coming-soon",
        emoji: "🛍️",
        title: "Can I Buy This?",
        blurb: "Quick purchase sanity checks",
      },
      {
        kind: "coming-soon",
        emoji: "📚",
        title: "Financial Literacy",
        blurb: "Core money concepts, explained",
      },
    ],
  },
];

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
        <h2 className="text-base font-bold tracking-tight text-slate-900">
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

function ComingSoonCard({
  emoji,
  title,
  blurb,
}: {
  emoji: string;
  title: string;
  blurb: string;
}) {
  return (
    <div
      className="relative flex min-h-[8.5rem] flex-col overflow-hidden rounded-2xl border border-dashed border-slate-300/80 bg-white/40 p-5 text-left opacity-70"
      aria-disabled="true"
    >
      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-slate-200/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden />
        Coming soon
      </span>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
        {emoji}
      </div>
      <span className="text-lg font-bold text-slate-700">{title}</span>
      <span className="mt-1 text-sm leading-relaxed text-slate-500">{blurb}</span>
    </div>
  );
}

type View = "hub" | SectionId | "costly-mistakes" | "start-here" | "why-rules";

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
        className={`hub-card group relative flex min-h-[8.5rem] flex-col overflow-hidden rounded-2xl border ${t.hub.border} p-0 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 active:translate-y-0 ${t.hub.shadow} ${t.hub.hoverShadow} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500`}
      >
        <div className={`${t.hub.gradient} flex-1 px-5 py-6 text-white`}>
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden />
            Available
          </span>
          <div
            className={`hub-icon mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${t.hub.iconBg} ${t.hub.iconColor}`}
          >
            {sectionIcon(id, "h-7 w-7")}
          </div>
          <span className="text-lg font-bold">
            {t.emoji} {title}
          </span>
          <span className="mt-1 block text-sm text-white/85">{blurb}</span>
        </div>
        <div className="flex items-center justify-between bg-white/90 px-5 py-3.5 text-sm font-semibold text-slate-700 backdrop-blur-sm transition-colors group-hover:text-slate-900">
          <span>Get started</span>
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
    targetView: "costly-mistakes",
    emoji: string,
    title: string,
    blurb: string
  ) {
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
        className="hub-card group relative flex min-h-[8.5rem] flex-col overflow-hidden rounded-2xl border border-teal-200/60 p-0 text-left shadow-sm shadow-teal-500/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-teal-500/20 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      >
        <div className="flex-1 bg-gradient-to-br from-teal-500 via-emerald-500 to-green-500 px-5 py-6 text-white">
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-200" aria-hidden />
            Available
          </span>
          <div className="hub-icon mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-2xl">
            {emoji}
          </div>
          <span className="text-lg font-bold">{title}</span>
          <span className="mt-1 block text-sm text-white/85">{blurb}</span>
        </div>
        <div className="flex items-center justify-between bg-white/90 px-5 py-3.5 text-sm font-semibold text-slate-700 backdrop-blur-sm transition-colors group-hover:text-slate-900">
          <span>Get started</span>
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
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            Personal finance guidance
          </p>
          <h1 className="bg-gradient-to-r from-indigo-700 via-violet-700 to-fuchsia-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
            Finance Rules
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-slate-600">
            Make calmer, clearer money decisions — and avoid the costly mistakes
            that quietly set you back.
          </p>
          <p className="mx-auto mt-2 max-w-lg text-xs text-slate-500">
            Rules decide. We explain. Structured guidance — not a generic chatbot.
          </p>
        </header>

        {view === "hub" ? (
          <div className="space-y-12">
            <section className="mx-auto max-w-xl text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Our philosophy
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
                Most financial mistakes come from a handful of major decisions.
                Before buying a house, financing a car, investing, or taking on
                debt, understand the tradeoffs first.
              </p>
            </section>

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
              className="hub-card group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 px-5 py-5 text-left text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/25 text-2xl backdrop-blur-sm">
                🧭
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold">
                  Not sure where to begin?
                </span>
                <span className="mt-0.5 block text-sm text-white/85">
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
                  item.kind === "section" ? (
                    renderSectionCard(item.id, item.title, item.blurb)
                  ) : item.kind === "view" ? (
                    renderViewCard(item.view, item.emoji, item.title, item.blurb)
                  ) : (
                    <ComingSoonCard
                      key={item.title}
                      emoji={item.emoji}
                      title={item.title}
                      blurb={item.blurb}
                    />
                  )
                )}
              </HubGroup>
            ))}

            <section className="rounded-2xl border border-slate-200/70 bg-white/70 p-6 backdrop-blur-sm">
              <h2 className="text-base font-bold tracking-tight text-slate-900">
                Why Finance Rules?
              </h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
                {[
                  "Structured assessments instead of generic chatbot answers",
                  "Transparent rules and reasoning",
                  "No financial products to sell",
                  "Designed to help people make better decisions",
                ].map((point) => (
                  <li key={point} className="flex gap-2.5">
                    <span className="mt-0.5 shrink-0 font-bold text-emerald-500" aria-hidden>
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
