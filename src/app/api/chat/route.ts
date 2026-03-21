import OpenAI from "openai";
import { ADVISOR_SYSTEM_PROMPT } from "@/lib/rules";
import { isFinanceQuestion } from "@/lib/scope";

/** Lazy init so `next build` does not require OPENAI_API_KEY (set it on Vercel for runtime). */
let openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  if (!openai) {
    openai = new OpenAI({ apiKey: key });
  }
  return openai;
}

export const dynamic = "force-dynamic";

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
  const body = await req.json();

  const messages = normalizeMessages(body.messages);
  const legacyQuestion =
    typeof body.question === "string" ? body.question.trim() : "";

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

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      {
        answer:
          "Server misconfiguration: OPENAI_API_KEY is not set. Add it in Vercel → Project → Settings → Environment Variables.",
      },
      { status: 503 }
    );
  }

  const completion = await getOpenAI().chat.completions.create({
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
    "Sorry — I couldn’t generate a reply. Please try again.";

  return Response.json({ answer });
}
