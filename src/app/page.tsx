"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  async function sendQuestion() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    const userMsg: ChatMessage = { id: newId(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const threadPayload = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ messages: threadPayload }),
      });

      const data = (await res.json()) as { answer?: string };
      if (!res.ok) {
        throw new Error("Request failed");
      }

      const answer =
        typeof data.answer === "string" ? data.answer : "No answer returned.";
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "assistant", content: answer },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: `Could not get a response: ${msg}`,
        },
      ]);
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

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-950 via-emerald-950/40 to-slate-950 text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.25),transparent)]"
        aria-hidden
      />
      <main className="relative mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-8 pt-10 sm:px-6">
        <header className="mb-8 text-center">
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.2em] text-emerald-400/90">
            Guidance
          </p>
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Finance Rules
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Ask a question — the assistant may ask you follow-ups (debt, match,
            emergency fund, HSA, Roth, 401(k), then investing) before giving a
            full plan.
          </p>
        </header>

        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-slate-900/50 shadow-2xl shadow-emerald-950/40 backdrop-blur-md">
          <div className="min-h-[min(420px,55vh)] flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {messages.length === 0 && !loading && (
              <p className="rounded-xl border border-dashed border-white/15 bg-white/5 px-4 py-8 text-center text-sm text-slate-400">
                Type a question below, then press{" "}
                <span className="text-emerald-300">Ask</span> or Enter.
              </p>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] min-w-0 rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-lg sm:max-w-[85%] ${
                    m.role === "user"
                      ? "bg-emerald-600 text-white"
                      : "border border-white/10 bg-slate-800/90 text-slate-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-800/80 px-4 py-3 text-sm text-slate-400">
                  <span
                    className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-400"
                    aria-hidden
                  />
                  Thinking…
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="border-t border-white/10 bg-slate-950/40 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="sr-only" htmlFor="question">
                Your question
              </label>
              <textarea
                id="question"
                rows={2}
                placeholder="e.g. How should I invest $10,000?"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={loading}
                className="min-h-[52px] w-full min-w-0 flex-1 resize-y rounded-xl border border-white/15 bg-slate-900/80 px-4 py-3 text-[15px] text-slate-100 placeholder:text-slate-500 outline-none ring-emerald-500/30 transition focus:border-emerald-500/50 focus:ring-2 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => void sendQuestion()}
                disabled={loading || !input.trim()}
                className="inline-flex h-[52px] shrink-0 items-center justify-center rounded-xl bg-emerald-500 px-8 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:pointer-events-none disabled:opacity-40"
              >
                {loading ? "Asking…" : "Ask"}
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-slate-500">
              Enter to send · Shift+Enter for a new line
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
