/**
 * Fire-and-forget anonymous click tracking. Never throws and never blocks UX.
 */
export function trackClick(
  target: string,
  opts?: { label?: string; event?: string }
): void {
  try {
    if (!target) return;
    void fetch("/api/track", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target,
        label: opts?.label,
        event: opts?.event,
        ts: Date.now(),
      }),
    }).catch(() => {
      /* swallow network errors; tracking must never affect UX */
    });
  } catch {
    /* swallow everything; tracking must never affect UX */
  }
}
