

import OpenAI from "openai";
import { ADVISOR_SYSTEM_PROMPT } from "@/lib/rules";
import { isFinanceQuestion } from "@/lib/scope";

/**
 * Read the OpenAI API key directly from process.env at runtime.
 * Checks multiple common env-var names so small naming mistakes
 * on Vercel don't silently fail.
 */
function getApiKey(): string | undefined {
  for (const name of ["OPENAI_API_KEY", "OPENAI_KEY", "OPEN_API_KEY"]) {
    const v = process.env[name];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

/** Lazy-init so `next build` doesn't require a key at import time. */
let openai: OpenAI | null = null;
function getOpenAI(key: string): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: key });
  }
  return openai;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/chat — diagnostic endpoint.
 * Returns whether the key is visible, which env-var names exist,
 * and the runtime environment.  No secret values are leaked.
 */
export async function GET() {
  const key = getApiKey();
  const envNames = ["OPENAI_API_KEY", "OPENAI_KEY", "OPEN_API_KEY"];
  const found = envNames.filter(
    (n) => typeof process.env[n] === "string" && process.env[n]!.trim().length > 0
  );

  return Response.json({
    openAiKeyConfigured: Boolean(key),
    keyLength: key ? key.length : 0,
    envVarsFound: found,
    nodeEnv: process.env.NODE_ENV,
    vercel: process.env.VERCEL === "1",
  });
}

const MAX_MESSAGES = 60;

type ClientMsg = { role: "user" | "assistant"; content: string };

function normalizeMessages(raw: unknown): ClientMsg[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ClientMsg[] = [];
  for (const m of raw) {
    if (
      m &&
      typeof m === "object" &&
      "role" in m &&
      "content" in m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof (m as { content: unknown }).content === "string"
    ) {
      const content = (m as { content: string }).content.trim();
      if (!content) continue;
      out.push({ role: m.role, content });
    }
  }
  return out.length ? out : null;
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { answer: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    const messages = normalizeMessages(
      body && typeof body === "object" && "messages" in body
        ? (body as { messages: unknown }).messages
        : null
    );
    const legacyQuestion =
      body &&
      typeof body === "object" &&
      "question" in body &&
      typeof (body as { question: unknown }).question === "string"
        ? (body as { question: string }).question.trim()
        : "";

    let thread: ClientMsg[];
    if (messages?.length) {
      thread = messages.slice(-MAX_MESSAGES);
    } else if (legacyQuestion) {
      thread = [{ role: "user", content: legacyQuestion }];
    } else {
      return Response.json({ answer: "Please enter a message." });
    }

    const userTurns = thread.filter((m) => m.role === "user");
    const firstUserContent = userTurns[0]?.content ?? "";
    if (userTurns.length === 1 && !isFinanceQuestion(firstUserContent)) {
      return Response.json({
        answer:
          "This chatbot only answers personal finance questions. Try asking about saving, debt, retirement, or investing.",
      });
    }

    const key = getApiKey();
    if (!key) {
      console.error(
        "[api/chat] No API key found. Env vars present:",
        Object.keys(process.env).filter((k) =>
          k.toLowerCase().includes("openai") || k.toLowerCase().includes("open_api")
        )
      );
      return Response.json(
        {
          answer:
            "Server misconfiguration: no OpenAI API key found. In Vercel → Settings → Environment Variables, add a variable named exactly OPENAI_API_KEY with your sk-… key, enable it for Production (and Preview if you use preview URLs), save, then Redeploy.",
        },
        { status: 503 }
      );
    }

    try {
      const completion = await getOpenAI(key).chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: ADVISOR_SYSTEM_PROMPT },
          ...thread.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
      });

      const answer =
        completion.choices[0].message.content?.trim() ||
        "Sorry — I couldn't generate a reply. Please try again.";

      return Response.json({ answer });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "OpenAI request failed";
      console.error("[api/chat] OpenAI", err);
      return Response.json(
        {
          answer: `Something went wrong talking to the AI: ${message}. If this is production, confirm OPENAI_API_KEY is set for this environment and your OpenAI account is in good standing.`,
        },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("[api/chat] fatal", err);
    return Response.json(
      {
        answer: `Unexpected server error: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }
}
