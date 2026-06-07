"use client";

import {
  COSTLY_MISTAKES,
  buildHeadline,
  buildReflections,
  costlyMistakePrompts,
  getCostlyMistakeTopic,
  getCostlyMistakeTopics,
  type CostlyMistakeAnswers,
  type CostlyMistakePrompt,
} from "@/lib/costly-mistakes";
import type { CostlyMistakeTopic } from "@/lib/specs";
import { useCallback, useMemo, useRef, useState } from "react";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

type Phase = "topics" | "questions" | "guidance" | "chat";

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const HEADER_GRADIENT = "bg-gradient-to-r from-rose-600 to-orange-600";
const ACCENT_LIGHT = "bg-rose-50 text-rose-900 border-rose-100";
const SEND_BTN =
  "bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 shadow-lg shadow-rose-500/30";
const SEND_BTN_DISABLED = "bg-slate-200 text-slate-400 shadow-none";
const USER_BUBBLE =
  "bg-gradient-to-br from-rose-600 to-orange-700 text-white shadow-md shadow-rose-500/25";
const ASSISTANT_BUBBLE =
  "bg-white/95 text-slate-800 border border-rose-100 shadow-sm ring-1 ring-rose-50";

function GuidanceSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-[15px] leading-relaxed text-slate-600">
            <span className="mt-1 text-rose-400" aria-hidden>
              •
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CostlyMistakesModule() {
  const topics = getCostlyMistakeTopics();
  const [phase, setPhase] = useState<Phase>("topics");
  const [topicId, setTopicId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<CostlyMistakeAnswers>({});

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [freeMode, setFreeMode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const topic: CostlyMistakeTopic | null = topicId
    ? getCostlyMistakeTopic(topicId)
    : null;

  const reflections = useMemo(
    () => (topic ? buildReflections(topic, answers) : []),
    [topic, answers]
  );

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  function selectTopic(id: string) {
    setTopicId(id);
    setStepIndex(0);
    setAnswers({});
    setMessages([]);
    setFreeMode(false);
    setPhase("questions");
  }

  function resetToTopics() {
    setPhase("topics");
    setTopicId(null);
    setStepIndex(0);
    setAnswers({});
    setMessages([]);
    setFreeMode(false);
  }

  function answerStep(questionId: string, value: string) {
    if (!topic) return;
    const next = { ...answers, [questionId]: value };
    setAnswers(next);
    if (stepIndex < topic.questions.length - 1) {
      setStepIndex((s) => s + 1);
    } else {
      setPhase("guidance");
    }
  }

  function goBackStep() {
    if (stepIndex === 0) {
      resetToTopics();
      return;
    }
    setStepIndex((s) => Math.max(0, s - 1));
  }

  async function send(messageText: string) {
    const text = messageText.trim();
    if (!text || loading || !topic) return;
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
          topic: "costly-mistakes",
          mistakeTopic: topic.id,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = (await res.json()) as { answer?: string };
      const reply =
        data.answer && data.answer.length > 0
          ? data.answer
          : "Something went wrong. Please try again.";
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "assistant", content: reply },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: `Could not reach the server: ${msg}.`,
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

  const prompts: CostlyMistakePrompt[] = topic ? costlyMistakePrompts(topic) : [];

  return (
    <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/80 shadow-lg shadow-slate-200/40 backdrop-blur-md">
      <div className={`${HEADER_GRADIENT} px-5 py-5 sm:px-7`}>
        <p className="text-xs font-medium uppercase tracking-wider text-white/75">
          Avoid Costly Mistakes
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">
          {phase === "topics"
            ? "Understand the big decisions"
            : topic
              ? `${topic.emoji} ${topic.name}`
              : "Avoid Costly Mistakes"}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-white/85">
          {phase === "topics"
            ? COSTLY_MISTAKES.meta.blurb
            : phase === "questions"
              ? "A few quick questions, then a clear, balanced breakdown."
              : phase === "guidance"
                ? "Costs, tradeoffs, who benefits, and alternatives."
                : "Ask anything about this decision."}
        </p>
      </div>

      <div className="p-6 sm:p-8">
        {phase === "topics" ? (
          <div className="space-y-4">
            <p className="text-[15px] leading-relaxed text-slate-600">
              {COSTLY_MISTAKES.intro}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {topics.map((t) => {
                const available = t.status === "available";
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={!available}
                    onClick={() => available && selectTopic(t.id)}
                    className={`flex flex-col rounded-xl border p-4 text-left transition ${
                      available
                        ? "border-slate-200 bg-white hover:border-rose-300 hover:shadow-md"
                        : "cursor-not-allowed border-dashed border-slate-200 bg-slate-50/60 opacity-70"
                    }`}
                  >
                    <span className="text-base font-semibold text-slate-900">
                      {t.emoji} {t.name}
                    </span>
                    <span className="mt-1 text-sm text-slate-500">{t.tagline}</span>
                    {!available ? (
                      <span className="mt-2 inline-block w-fit rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                        Coming soon
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              {COSTLY_MISTAKES.principle}
            </p>
          </div>
        ) : null}

        {phase === "questions" && topic ? (
          <QuestionStep
            topic={topic}
            stepIndex={stepIndex}
            answers={answers}
            onAnswer={answerStep}
            onBack={goBackStep}
          />
        ) : null}

        {phase === "guidance" && topic ? (
          <div className="space-y-7">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Educational guidance
              </p>
              <h3 className="text-lg font-semibold text-slate-900">
                {buildHeadline(topic, answers)}
              </h3>
            </div>

            {reflections.length > 0 ? (
              <section
                className={`space-y-2 rounded-xl border px-4 py-4 ${ACCENT_LIGHT}`}
              >
                <h3 className="text-sm font-semibold">What this means for you</h3>
                <ul className="space-y-2">
                  {reflections.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed">
                      <span aria-hidden>•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-800">What is it?</h3>
              <p className="text-[15px] leading-relaxed text-slate-600">
                {topic.what_is_it}
              </p>
            </section>

            <GuidanceSection title="Why do people buy it?" items={topic.why_people_buy} />
            <GuidanceSection title="What are the costs?" items={topic.costs} />
            <GuidanceSection title="Who benefits?" items={topic.who_benefits} />
            <GuidanceSection title="What are the alternatives?" items={topic.alternatives} />
            <GuidanceSection
              title="Questions to ask before buying"
              items={topic.questions_to_ask}
            />

            <p className="text-xs leading-relaxed text-slate-500">
              {COSTLY_MISTAKES.disclaimer}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setPhase("chat")}
                className={`rounded-xl px-5 py-3.5 text-sm font-bold text-white transition ${SEND_BTN}`}
              >
                Ask a question
              </button>
              <button
                type="button"
                onClick={resetToTopics}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Explore another topic
              </button>
            </div>
          </div>
        ) : null}

        {phase === "chat" && topic ? (
          <div className="flex min-h-[min(440px,60vh)] flex-col">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPhase("guidance")}
                className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                <span aria-hidden>←</span> Back to guidance
              </button>
            </div>

            <div className="chat-scroll flex-1 space-y-4 overflow-y-auto">
              {messages.length === 0 && !loading ? (
                <div className="space-y-4 py-4">
                  <p className="text-center text-sm text-slate-600">
                    Ask about {topic.name} — costs, alternatives, or what to ask before
                    committing.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {prompts.map((p) => (
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
                  <p className="text-center">
                    <button
                      type="button"
                      onClick={() => setFreeMode(true)}
                      className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
                    >
                      Ask something else in your own words
                    </button>
                  </p>
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
                  placeholder={`Ask about ${topic.name}…`}
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
                {COSTLY_MISTAKES.disclaimer}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function QuestionStep({
  topic,
  stepIndex,
  answers,
  onAnswer,
  onBack,
}: {
  topic: CostlyMistakeTopic;
  stepIndex: number;
  answers: CostlyMistakeAnswers;
  onAnswer: (questionId: string, value: string) => void;
  onBack: () => void;
}) {
  const question = topic.questions[stepIndex];
  const total = topic.questions.length;
  const current = answers[question.id];

  const options =
    question.type === "yesno"
      ? [
          { id: "yes", label: "Yes" },
          { id: "no", label: "No" },
        ]
      : question.options ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-slate-500">
          <span>
            Question {stepIndex + 1} of {total}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={HEADER_GRADIENT}
            style={{
              width: `${((stepIndex + 1) / total) * 100}%`,
              height: "100%",
            }}
          />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-slate-900">{question.prompt}</h3>

      <div className="flex flex-col gap-3">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onAnswer(question.id, opt.id)}
            className={`rounded-xl border-2 px-4 py-4 text-left text-sm font-semibold transition ${
              current === opt.id
                ? "border-rose-500 bg-rose-50 text-rose-900 ring-2 ring-rose-500/20"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <span aria-hidden>←</span> {stepIndex === 0 ? "All topics" : "Back"}
      </button>
    </div>
  );
}
