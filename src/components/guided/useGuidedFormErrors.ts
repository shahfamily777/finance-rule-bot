"use client";

import { useCallback, useState } from "react";

/** Local + parent sanity errors; clear both when the user edits a field. */
export function useGuidedFormErrors(
  externalError?: string | null,
  onClearExternal?: () => void
) {
  const [error, setError] = useState<string | null>(null);

  const dismissErrors = useCallback(() => {
    setError(null);
    onClearExternal?.();
  }, [onClearExternal]);

  const wrapChange =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      dismissErrors();
      setter(v);
    };

  const displayError = error ?? externalError ?? null;

  return {
    error,
    setError,
    displayError,
    dismissErrors,
    wrapChange,
  };
}
