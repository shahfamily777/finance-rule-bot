export type SectionId = "car-loan" | "mortgage" | "investment";

export type SectionTheme = {
  id: SectionId;
  label: string;
  emoji: string;
  /** Hub topic card */
  hub: {
    gradient: string;
    iconBg: string;
    iconColor: string;
    border: string;
    shadow: string;
    hoverShadow: string;
  };
  /** Section shell / header */
  shell: {
    headerGradient: string;
    accent: string;
    accentLight: string;
    ring: string;
    choiceActive: string;
  };
  /** Chat */
  chat: {
    userBubble: string;
    assistantBubble: string;
    composerBg: string;
    sendBtn: string;
    sendBtnDisabled: string;
  };
  /** Form submit */
  submitBtn: string;
};

export const SECTION_THEMES: Record<SectionId, SectionTheme> = {
  "car-loan": {
    id: "car-loan",
    label: "Car loan",
    emoji: "🚗",
    hub: {
      gradient: "bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600",
      iconBg: "bg-white/25 backdrop-blur-sm",
      iconColor: "text-white",
      border: "border-blue-200/60",
      shadow: "shadow-lg shadow-blue-500/20",
      hoverShadow: "hover:shadow-xl hover:shadow-blue-500/30",
    },
    shell: {
      headerGradient: "bg-gradient-to-r from-blue-600 to-indigo-600",
      accent: "text-blue-600",
      accentLight: "bg-blue-50 text-blue-800 border-blue-100",
      ring: "ring-blue-500/30 focus-visible:ring-blue-500",
      choiceActive: "border-blue-500 bg-blue-50 text-blue-900 ring-2 ring-blue-500/20",
    },
    chat: {
      userBubble: "bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/25",
      assistantBubble:
        "bg-white/95 text-slate-800 border border-blue-100 shadow-sm ring-1 ring-blue-50",
      composerBg: "bg-gradient-to-t from-blue-50/90 to-white/80",
      sendBtn:
        "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/30",
      sendBtnDisabled: "bg-slate-200 text-slate-400 shadow-none",
    },
    submitBtn:
      "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40",
  },
  mortgage: {
    id: "mortgage",
    label: "Mortgage",
    emoji: "🏠",
    hub: {
      gradient: "bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600",
      iconBg: "bg-white/25 backdrop-blur-sm",
      iconColor: "text-white",
      border: "border-emerald-200/60",
      shadow: "shadow-lg shadow-emerald-500/20",
      hoverShadow: "hover:shadow-xl hover:shadow-emerald-500/30",
    },
    shell: {
      headerGradient: "bg-gradient-to-r from-emerald-600 to-teal-600",
      accent: "text-emerald-600",
      accentLight: "bg-emerald-50 text-emerald-900 border-emerald-100",
      ring: "ring-emerald-500/30 focus-visible:ring-emerald-500",
      choiceActive: "border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20",
    },
    chat: {
      userBubble:
        "bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-500/25",
      assistantBubble:
        "bg-white/95 text-slate-800 border border-emerald-100 shadow-sm ring-1 ring-emerald-50",
      composerBg: "bg-gradient-to-t from-emerald-50/90 to-white/80",
      sendBtn:
        "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/30",
      sendBtnDisabled: "bg-slate-200 text-slate-400 shadow-none",
    },
    submitBtn:
      "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40",
  },
  investment: {
    id: "investment",
    label: "Investment",
    emoji: "📈",
    hub: {
      gradient: "bg-gradient-to-br from-violet-400 via-purple-500 to-fuchsia-600",
      iconBg: "bg-white/25 backdrop-blur-sm",
      iconColor: "text-white",
      border: "border-violet-200/60",
      shadow: "shadow-lg shadow-violet-500/20",
      hoverShadow: "hover:shadow-xl hover:shadow-violet-500/30",
    },
    shell: {
      headerGradient: "bg-gradient-to-r from-violet-600 to-fuchsia-600",
      accent: "text-violet-600",
      accentLight: "bg-violet-50 text-violet-900 border-violet-100",
      ring: "ring-violet-500/30 focus-visible:ring-violet-500",
      choiceActive: "border-violet-500 bg-violet-50 text-violet-900 ring-2 ring-violet-500/20",
    },
    chat: {
      userBubble:
        "bg-gradient-to-br from-violet-600 to-fuchsia-700 text-white shadow-md shadow-violet-500/25",
      assistantBubble:
        "bg-white/95 text-slate-800 border border-violet-100 shadow-sm ring-1 ring-violet-50",
      composerBg: "bg-gradient-to-t from-violet-50/90 to-white/80",
      sendBtn:
        "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 shadow-lg shadow-violet-500/30",
      sendBtnDisabled: "bg-slate-200 text-slate-400 shadow-none",
    },
    submitBtn:
      "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40",
  },
};

export function getSectionTheme(id: SectionId): SectionTheme {
  return SECTION_THEMES[id];
}

/** Shared input classes — pair with data-section on parent for focus colors */
export const INTAKE_INPUT =
  "intake-input w-full rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 text-[15px] text-slate-900 shadow-sm backdrop-blur-sm transition placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2";

export const INTAKE_LABEL = "mb-1.5 block text-sm font-semibold text-slate-700";

export const INTAKE_HINT = "mt-1 text-xs text-slate-500";

export const INTAKE_SUBMIT_BASE =
  "w-full rounded-xl py-3.5 text-sm font-bold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50";
