import { useRef } from "react";

export const SANITY_CONTINUE_HINT =
  " If this number is correct, click Continue again to proceed.";

/**
 * Two-step sanity: first Continue shows a warning; second Continue with the same
 * message lets the user proceed (they may have the right number).
 */
export function useSanityAck() {
  const pendingMessage = useRef<string | null>(null);
  const acknowledged = useRef(false);

  function resetSanityAck() {
    pendingMessage.current = null;
  }

  function resetAll() {
    pendingMessage.current = null;
    acknowledged.current = false;
  }

  /**
   * @returns true if the action should stop (warning shown); false if caller should proceed
   */
  function warnOrProceed(message: string, setError: (msg: string) => void): boolean {
    if (pendingMessage.current === message) {
      pendingMessage.current = null;
      acknowledged.current = true;
      return false;
    }
    pendingMessage.current = message;
    setError(message + SANITY_CONTINUE_HINT);
    return true;
  }

  function consumeAcknowledged(): boolean {
    const v = acknowledged.current;
    acknowledged.current = false;
    return v;
  }

  function isAcknowledged(): boolean {
    return acknowledged.current;
  }

  return {
    warnOrProceed,
    resetSanityAck,
    resetAll,
    consumeAcknowledged,
    isAcknowledged,
  };
}

export type GuidedSubmitOptions = { sanityAcknowledged?: boolean };
