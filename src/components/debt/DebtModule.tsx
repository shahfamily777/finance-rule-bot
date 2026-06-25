"use client";

import { DebtAssessmentFlow } from "@/components/debt/DebtAssessmentFlow";
import { DebtFreeDateCalculator } from "@/components/debt/DebtFreeDateCalculator";
import { DebtVsInvestingView } from "@/components/debt/DebtVsInvestingView";
import { SnowballAvalancheView } from "@/components/debt/SnowballAvalancheView";
import { explainDebtQuestion } from "@/lib/debt/explainer";
import { debtSpec } from "@/lib/specs/bundle";
import { useCallback, useRef, useState } from "react";

type DebtSectionId =
  | "assessment"
  | "snowball_avalanche"
  | "debt_vs_investing"
  | "debt_free_date"
  | "chat";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const HEADER_GRADIENT = "bg-gradient-to-r from-slate-700 to-stone-800";
const ACCENT_LIGHT = "bg-slate-50 text-slate-900 border-slate-200";
const SEND_BTN =
  "bg-gradient-to-r from-slate-700 to-stone-800 hover:from-slate-600 hover:to-stone-700 shadow-lg shadow-slate-500/30";
const SEND_BTN_DISABLED = "bg-slate-200 text-slate-400 shadow-none";
const USER_BUBBLE =
  "bg-gradient-to-br from-slate-700 to-stone-800 text-white shadow-md shadow-slate-500/25";
const ASSISTANT_BUBBLE =
  "bg-white/95 text-slate-800 border border-slate-200 shadow-sm ring-1 ring-slate-50";

const SECTIONS = debtSpec.sections;

const CHAT_PROMPTS = [
  { id: "snowball", label: "What is the debt snowball?", message: "What is the debt snowball method?" },
  { id: "avalanche", label: "Snowball vs avalanche?", message: "Which is better, snowball or avalanche?" },
  { id: "invest", label: "Debt vs investing?", message: "Should I pay off debt or invest?" },
  { id: "high", label: "High-interest debt?", message: "Why pay high-interest debt first?" },
];

export function DebtModule() {
  const [section, setSection] = useState<DebtSectionId | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [freeMode, setFreeMode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  function goToSections() {
    setSection(null);
    setMessages([]);
    setFreeMode(false);
  }

  async function send(messageText: string) {
    const text = messageText.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg: ChatMessage = { id: newId(), role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          topic: "debt",
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = (await res.json()) as { answer?: string };
      const reply =
        data.answer && data.answer.length > 0
          ? data.answer
          : explainDebtQuestion({ thread: nextMessages }) ??
            "Something went wrong. Please try again.";
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "assistant", content: reply },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      const fallback = explainDebtQuestion({ thread: nextMessages });
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: fallback ?? `Could not reach the server: ${msg}.`,
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(scrollToBottom, 50);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  const sectionMeta = SECTIONS.find((s) => s.id === section);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/80 shadow-lg shadow-slate-200/40 backdrop-blur-md">
      <div className={`${HEADER_GRADIENT} px-5 py-5 sm:px-7`}>
        <p className="text-xs font-medium uppercase tracking-wider text-white/75">
          {debtSpec.meta.label}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">
          {section === null
            ? debtSpec.meta.label
            : section === "chat"
              ? "Ask about debt"
              : sectionMeta?.title ?? debtSpec.meta.label}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-white/85">
          {section === null
            ? debtSpec.meta.blurb
            : section === "chat"
              ? "Deterministic answers about payoff strategies and rules."
              : sectionMeta?.description}
        </p>
      </div>

      <div className="p-6 sm:p-8">
        {section === null ? (
          <div className="space-y-4">
            <p className="text-[15px] leading-relaxed text-slate-600">
              {debtSpec.messages.assessment_intro}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSection(s.id as DebtSectionId)}
                  className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-400 hover:shadow-md"
                >
                  <span className="text-base font-semibold text-slate-900">{s.title}</span>
                  <span className="mt-1 text-sm text-slate-500">{s.description}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSection("chat")}
              className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm font-semibold transition sm:w-auto ${ACCENT_LIGHT} hover:shadow-sm`}
            >
              Ask a question about debt
            </button>
            <p className="text-xs leading-relaxed text-slate-500">
              {debtSpec.messages.disclaimer}
            </p>
          </div>
        ) : null}

        {section === "assessment" ? (
          <DebtAssessmentFlow
            onBack={goToSections}
            onExploreRules={() => setSection("chat")}
          />
        ) : null}
        {section === "snowball_avalanche" ? (
          <SnowballAvalancheView onBack={goToSections} />
        ) : null}
        {section === "debt_vs_investing" ? (
          <DebtVsInvestingView onBack={goToSections} />
        ) : null}
        {section === "debt_free_date" ? (
          <DebtFreeDateCalculator onBack={goToSections} />
        ) : null}

        {section === "chat" ? (
          <div className="flex min-h-[min(440px,60vh)] flex-col">
            <div className="mb-3">
              <button
                type="button"
                onClick={goToSections}
                className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                <span aria-hidden>←</span> All sections
              </button>
            </div>

            <div className="chat-scroll flex-1 space-y-4 overflow-y-auto">
              {messages.length === 0 && !loading ? (
                <div className="space-y-4 py-4">
                  <p className="text-center text-sm text-slate-600">
                    Ask about payoff methods, high-interest debt, or debt vs investing.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {CHAT_PROMPTS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={loading}
                        onClick={() => void send(p.message)}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition hover:shadow-sm disabled:opacity-50 ${ACCENT_LIGHT}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {!freeMode ? (
                    <p className="text-center">
                      <button
                        type="button"
                        onClick={() => setFreeMode(true)}
                        className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
                      >
                        Ask something else in your own words
                      </button>
                    </p>
                  ) : null}
                </div>
              ) : null}

              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[92%] min-w-0 rounded-2xl px-4 py-3 text-[15px] leading-relaxed sm:max-w-[85%] ${
                      m.role === "user" ? USER_BUBBLE : ASSISTANT_BUBBLE
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  </div>
                </div>
              ))}

              {loading ? (
                <div className="flex justify-start">
                  <div
                    className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${ACCENT_LIGHT}`}
                  >
                    <span
                      className="inline-flex h-2 w-2 animate-pulse rounded-full bg-current opacity-60"
                      aria-hidden
                    />
                    Working…
                  </div>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>

            <div className="mt-4 border-t border-slate-200/80 pt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <textarea
                  rows={2}
                  placeholder="Ask about debt strategies…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={loading}
                  className="min-h-[52px] w-full resize-y rounded-xl border border-slate-200/80 bg-white/95 px-4 py-3 text-[15px] text-slate-900 shadow-inner placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-500/20 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => void send(input)}
                  disabled={loading || !input.trim()}
                  className={`inline-flex h-[52px] shrink-0 items-center justify-center rounded-xl px-8 text-sm font-bold text-white disabled:pointer-events-none ${
                    loading || !input.trim() ? SEND_BTN_DISABLED : SEND_BTN
                  }`}
                >
                  Ask
                </button>
              </div>
              <p className="mt-2 text-center text-xs text-slate-500">
                {debtSpec.messages.disclaimer}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
