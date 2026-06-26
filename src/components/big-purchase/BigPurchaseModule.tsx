"use client";

import { BigPurchaseAssessmentFlow } from "@/components/big-purchase/BigPurchaseAssessmentFlow";
import { explainBigPurchaseQuestion } from "@/lib/big-purchase/explainer";
import { bigPurchaseSpec } from "@/lib/specs/bundle";
import { useCallback, useRef, useState } from "react";

type SectionId = "assessment" | "chat";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const HEADER_GRADIENT = "bg-gradient-to-r from-rose-700 to-orange-800";
const ACCENT_LIGHT = "bg-rose-50 text-rose-900 border-rose-200";
const SEND_BTN =
  "bg-gradient-to-r from-rose-700 to-orange-800 hover:from-rose-600 hover:to-orange-700 shadow-lg shadow-rose-500/30";
const SEND_BTN_DISABLED = "bg-slate-200 text-slate-400 shadow-none";
const USER_BUBBLE =
  "bg-gradient-to-br from-rose-700 to-orange-800 text-white shadow-md shadow-rose-500/25";
const ASSISTANT_BUBBLE =
  "bg-white/95 text-slate-800 border border-slate-200 shadow-sm ring-1 ring-slate-50";

const CHAT_PROMPTS = [
  { id: "comfortable", label: "What is Comfortable?", message: "What does Comfortable mean?" },
  { id: "stretch", label: "What is Stretch?", message: "What does Stretch mean?" },
  { id: "dti", label: "Debt-to-income?", message: "How does debt-to-income work?" },
  { id: "tradeoff", label: "Opportunity cost?", message: "What is opportunity cost?" },
];

export function BigPurchaseModule() {
  const [section, setSection] = useState<SectionId | null>(null);
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
          topic: "big-purchase",
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = (await res.json()) as { answer?: string };
      const reply =
        data.answer && data.answer.length > 0
          ? data.answer
          : explainBigPurchaseQuestion({ thread: nextMessages }) ??
            "Something went wrong. Please try again.";
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "assistant", content: reply },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      const fallback = explainBigPurchaseQuestion({ thread: nextMessages });
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

  return (
    <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/80 shadow-lg shadow-slate-200/40 backdrop-blur-md">
      <div className={`${HEADER_GRADIENT} px-5 py-5 sm:px-7`}>
        <p className="text-xs font-medium uppercase tracking-wider text-white/75">
          {bigPurchaseSpec.meta.label}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">
          {section === null
            ? bigPurchaseSpec.meta.label
            : section === "chat"
              ? "Ask about big purchases"
              : "Purchase assessment"}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-white/85">
          {section === null
            ? bigPurchaseSpec.meta.blurb
            : section === "chat"
              ? "Deterministic answers about affordability thresholds and tradeoffs."
              : "Enter your numbers for a calm affordability check."}
        </p>
      </div>

      <div className="p-6 sm:p-8">
        {section === null ? (
          <div className="space-y-4">
            <p className="text-[15px] leading-relaxed text-slate-600">
              {bigPurchaseSpec.messages.assessment_intro}
            </p>
            <button
              type="button"
              onClick={() => setSection("assessment")}
              className="flex w-full flex-col rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-rose-300 hover:shadow-md"
            >
              <span className="text-base font-semibold text-slate-900">
                Start purchase assessment
              </span>
              <span className="mt-1 text-sm text-slate-500">
                Enter purchase details and your financial picture
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSection("chat")}
              className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold transition sm:w-auto ${ACCENT_LIGHT} hover:shadow-sm`}
            >
              Ask a question
            </button>
            <p className="text-xs leading-relaxed text-slate-500">
              {bigPurchaseSpec.messages.disclaimer}
            </p>
          </div>
        ) : null}

        {section === "assessment" ? (
          <BigPurchaseAssessmentFlow
            onBack={goToSections}
            onExploreRules={() => setSection("chat")}
          />
        ) : null}

        {section === "chat" ? (
          <div className="flex min-h-[min(440px,60vh)] flex-col">
            <div className="mb-3">
              <button
                type="button"
                onClick={goToSections}
                className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                <span aria-hidden>←</span> Back
              </button>
            </div>

            <div className="chat-scroll flex-1 space-y-4 overflow-y-auto">
              {messages.length === 0 && !loading ? (
                <div className="space-y-4 py-4">
                  <p className="text-center text-sm text-slate-600">
                    Ask about affordability categories, debt-to-income, or tradeoffs.
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
                  placeholder="Ask about big purchase rules…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={loading}
                  className="min-h-[52px] w-full resize-y rounded-xl border border-slate-200/80 bg-white/95 px-4 py-3 text-[15px] text-slate-900 shadow-inner placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-rose-500/20 disabled:opacity-60"
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
                {bigPurchaseSpec.messages.disclaimer}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
