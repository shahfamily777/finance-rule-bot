"use client";

import { GUIDED_PROMPTS, type GuidedPrompt } from "@/lib/guided-prompts";
import type { SectionTheme } from "@/lib/section-theme";
import type { SectionId } from "@/lib/section-theme";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

export function GuidedChat({
  section,
  theme,
  messages,
  loading,
  freeMode,
  onPrompt,
  onEnableFreeMode,
  onUpdateNumbers,
  input,
  onInputChange,
  onSend,
  onKeyDown,
}: {
  section: SectionId;
  theme: SectionTheme;
  messages: ChatMessage[];
  loading: boolean;
  freeMode: boolean;
  onPrompt: (prompt: GuidedPrompt) => void;
  onEnableFreeMode: () => void;
  onUpdateNumbers: () => void;
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const prompts = GUIDED_PROMPTS[section];
  const showPrompts = !freeMode && messages.length <= 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex justify-end px-4 pt-3 sm:px-5">
        <button
          type="button"
          onClick={onUpdateNumbers}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${theme.shell.accentLight}`}
        >
          Update your numbers
        </button>
      </div>

      <div className="chat-scroll flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
        {messages.length === 0 && !loading ? (
          <div className="space-y-4 py-4">
            <p className="text-center text-sm text-slate-600">
              Pick a question below. Answers follow this section&apos;s fixed rules — not
              open-ended AI guesses.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {prompts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={loading}
                  onClick={() => onPrompt(p)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition hover:shadow-sm disabled:opacity-50 ${theme.shell.accentLight}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-center">
              <button
                type="button"
                onClick={onEnableFreeMode}
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
                m.role === "user"
                  ? theme.chat.userBubble
                  : theme.chat.assistantBubble
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
            </div>
          </div>
        ))}

        {loading ? (
          <div className="flex justify-start">
            <div
              className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${theme.shell.accentLight}`}
            >
              <span
                className="inline-flex h-2 w-2 animate-pulse rounded-full bg-current opacity-60"
                aria-hidden
              />
              Working…
            </div>
          </div>
        ) : null}

        {showPrompts && messages.length > 0 ? (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {prompts.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={loading}
                onClick={() => onPrompt(p)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${theme.shell.accentLight}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {(freeMode || messages.length > 0) && (
        <div className={`border-t border-slate-200/80 p-4 sm:p-5 ${theme.chat.composerBg}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <textarea
              rows={2}
              placeholder="Ask about the rules for your situation…"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={loading}
              className="min-h-[52px] w-full resize-y rounded-xl border border-slate-200/80 bg-white/95 px-4 py-3 text-[15px] text-slate-900 shadow-inner placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={onSend}
              disabled={loading || !input.trim()}
              className={`inline-flex h-[52px] shrink-0 items-center justify-center rounded-xl px-8 text-sm font-bold text-white disabled:pointer-events-none ${
                loading || !input.trim()
                  ? theme.chat.sendBtnDisabled
                  : theme.chat.sendBtn
              }`}
            >
              Ask
            </button>
          </div>
          {!freeMode ? (
            <p className="mt-2 text-center text-xs text-slate-500">
              Or use the suggested questions above
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
