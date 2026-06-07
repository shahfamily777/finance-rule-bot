"use client";

import { useFormTheme } from "@/components/FormThemeContext";
import {
  INTAKE_HINT,
  INTAKE_INPUT,
  INTAKE_LABEL,
  INTAKE_SUBMIT_BASE,
} from "@/lib/section-theme";

export function FormError({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {message}
    </p>
  );
}

export function IntakeField({
  id,
  label,
  hint,
  required = true,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={INTAKE_LABEL}>
        {label}
        {required ? <span className="font-normal text-rose-500"> *</span> : null}
      </label>
      {children}
      {hint ? <p className={INTAKE_HINT}>{hint}</p> : null}
    </div>
  );
}

export function IntakeMoneyInput({
  id,
  label,
  value,
  onChange,
  hint,
  optional,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  optional?: boolean;
  placeholder?: string;
}) {
  return (
    <IntakeField id={id} label={label} hint={hint} required={!optional}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        placeholder={placeholder ?? (optional ? "Optional" : "e.g. 50000 or 50k")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={INTAKE_INPUT}
        required={!optional}
      />
    </IntakeField>
  );
}

export function IntakeYesNo({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  const theme = useFormTheme();
  return (
    <IntakeField id={id} label={label}>
      <div className="flex flex-wrap gap-3" role="group">
        {(
          [
            [true, "Yes"],
            [false, "No"],
          ] as const
        ).map(([v, text]) => (
          <label
            key={text}
            className={`flex cursor-pointer items-center gap-2.5 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition ${
              value === v
                ? theme.shell.choiceActive
                : "border-slate-200/80 bg-white/60 text-slate-600 hover:border-slate-300 hover:bg-white"
            }`}
          >
            <input
              type="radio"
              name={id}
              className="sr-only"
              checked={value === v}
              onChange={() => onChange(v)}
            />
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                value === v ? "border-current" : "border-slate-300"
              }`}
            >
              {value === v ? (
                <span className="h-2 w-2 rounded-full bg-current" />
              ) : null}
            </span>
            {text}
          </label>
        ))}
      </div>
    </IntakeField>
  );
}

export function IntakeSubmit({
  loading,
  children,
}: {
  loading: boolean;
  children: React.ReactNode;
}) {
  const theme = useFormTheme();
  return (
    <button
      type="submit"
      disabled={loading}
      className={`${INTAKE_SUBMIT_BASE} ${theme.submitBtn}`}
    >
      {children}
    </button>
  );
}
