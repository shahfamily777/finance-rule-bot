export function parseNum(raw: string): number | null {
  const t = raw.replace(/,/g, "").trim();
  if (!t) return null;
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(k|m)?$/i);
  if (!m) {
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  let n = Number(m[1]);
  const s = (m[2] || "").toLowerCase();
  if (s === "k") n *= 1000;
  if (s === "m") n *= 1_000_000;
  return Number.isFinite(n) ? n : null;
}
