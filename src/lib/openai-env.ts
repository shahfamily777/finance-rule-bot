"use server";

/**
 * OpenAI API key from the environment.
 *
 * Uses dynamic `process.env[name]` lookups so Next.js / Turbopack does not
 * replace the value at build time with `undefined` when the key exists only
 * on Vercel at runtime.
 *
 * Vercel: add OPENAI_API_KEY (or OPENAI_KEY / OPEN_API_KEY) for Production
 * and redeploy.
 */
function pick(name: string): string | undefined {
  const v = process.env[name];
  if (typeof v === "string") {
    const key = v.trim();
    if (key.length > 0) return key;
  }
  return undefined;
}

export function getOpenAiApiKey(): string | undefined {
  return (
    pick("OPENAI_API_KEY") ??
    pick("OPENAI_KEY") ??
    pick("OPEN_API_KEY")
  );
}
