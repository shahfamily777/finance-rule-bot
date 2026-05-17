"use client";

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
    label: "Car loan",
    blurb: "Affordability, rates, refinance",
  },
  {
    id: "mortgage",
    label: "Mortgage",
    blurb: "Down payment, refi, monthly cost",
  },
  {
    id: "investment",
    label: "Investment",
    blurb: "Guided money order & investing",
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

export default function Home() {
  const [view, setView] = useState<"hub" | SectionId>("hub");
  const [input, setInput] = useState("");
  const [messagesBySection, setMessagesBySection] =
    useState<Record<SectionId, ChatMessage[]>>(EMPTY_MESSAGES);
  const [chatStateBySection, setChatStateBySection] =
    useState<Record<SectionId, unknown>>(EMPTY_STATE);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages =
    view === "hub" ? [] : messagesBySection[view];

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, view, scrollToBottom]);

  async function sendQuestion() {
    if (view === "hub") return;
    const text = input.trim();
    if (!text || loading) return;

    const section = view;

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

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-white text-neutral-900">
      <main className="relative mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-8 pt-10 sm:px-6">
        <header className="mb-8 text-center">
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
            Guidance
          </p>
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-black sm:text-4xl">
            Finance Rules
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Choose a topic, then ask questions. Each area keeps its own
            conversation.
          </p>
        </header>

        {view === "hub" ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setView(s.id)}
                className="group relative flex flex-col items-center rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center shadow-sm transition hover:border-neutral-300 hover:bg-white hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-neutral-900 transition group-hover:border-neutral-300">
                  {sectionIcon(s.id, "h-8 w-8")}
                </div>
                <span className="text-lg font-semibold text-black">{s.label}</span>
                <span className="mt-1 text-xs text-neutral-600">{s.blurb}</span>
                <span className="mt-3 text-xs font-medium text-neutral-900">
                  Open →
                </span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setView("hub")}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
              >
                <span aria-hidden>←</span> All topics
              </button>
              {activeMeta && (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900">
                    {sectionIcon(activeMeta.id, "h-5 w-5")}
                  </span>
                  <div className="min-w-0 text-left">
                    <p className="truncate text-sm font-semibold text-black">
                      {activeMeta.label}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {activeMeta.blurb}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="min-h-[min(420px,55vh)] flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                {view === "investment" && (
                  <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-800">
                    Investment mode: the assistant may ask follow-ups (match,
                    emergency fund, debt, HSA, Roth, 401(k)) before a full plan.
                  </p>
                )}
                {view === "car-loan" && (
                  <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-800">
                    <strong>Car loan only.</strong> Ask rule questions directly
                    (e.g. “Is 72 months too long?”) or share your numbers for a
                    checklist. Fixed rules: ≥20% down · max 48 months · transport
                    ≤10% of income. Other topics → <strong>All topics</strong>.
                  </p>
                )}
                {view === "mortgage" && (
                  <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-800">
                    <strong>Mortgage only.</strong> Start with purchase price (e.g.
                    500k) — we&apos;ll ask income, down payment, cash readiness, rate,
                    then check housing ≤35% of gross income (PITI + tax + insurance +
                    HOA/repairs). Other topics → <strong>All topics</strong>.
                  </p>
                )}
                {view === "investment" && (
                  <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-800">
                    <strong>Personal finance / investment only.</strong> Car loans
                    and mortgages → use <strong>All topics</strong>. Other
                    subjects are not answered.
                  </p>
                )}
                {view === "mortgage" && (
                  <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-800">
                    Mortgage Q&A — more structure coming soon. Ask about down
                    payments, PMI, refi, or monthly payment.
                  </p>
                )}

                {messages.length === 0 && !loading && (
                  <p className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-600">
                    Type a question below, then press{" "}
                    <span className="font-medium text-black">Ask</span> or Enter.
                  </p>
                )}

                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[92%] min-w-0 rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm sm:max-w-[85%] ${
                        m.role === "user"
                          ? "bg-neutral-900 text-white"
                          : "border border-neutral-200 bg-neutral-50 text-neutral-900"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                      <span
                        className="inline-flex h-2 w-2 animate-pulse rounded-full bg-neutral-900"
                        aria-hidden
                      />
                      Thinking…
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              <div className="border-t border-neutral-200 bg-neutral-50/80 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="sr-only" htmlFor="question">
                    Your question
                  </label>
                  <textarea
                    id="question"
                    rows={2}
                    placeholder={
                      view === "investment"
                        ? "e.g. How should I invest $10,000?"
                        : view === "car-loan"
                          ? "e.g. Is 72 months too long for a car loan?"
                          : "e.g. How much should I put down on a house?"
                    }
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    disabled={loading}
                    className="min-h-[52px] w-full min-w-0 flex-1 resize-y rounded-xl border border-neutral-300 bg-white px-4 py-3 text-[15px] text-neutral-900 placeholder:text-neutral-400 outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/15 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => void sendQuestion()}
                    disabled={loading || !input.trim()}
                    className="inline-flex h-[52px] shrink-0 items-center justify-center rounded-xl bg-black px-8 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:pointer-events-none disabled:opacity-40"
                  >
                    {loading ? "Asking…" : "Ask"}
                  </button>
                </div>
                <p className="mt-2 text-center text-xs text-neutral-500">
                  Enter to send · Shift+Enter for a new line
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
