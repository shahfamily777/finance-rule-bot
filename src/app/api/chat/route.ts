import { isFinanceQuestion } from "@/lib/scope";
import { handleConversationalFlow, type ConversationState } from "@/lib/conversation";
import {
  handleCarLoanFlow,
  isCarLoanFlowActive,
  type CarLoanConversationState,
} from "@/lib/car-loan-flow";
import {
  handleMortgageFlow,
  isMortgageFlowActive,
  type MortgageConversationState,
} from "@/lib/mortgage-flow";
import {
  getUnknownDomainReply,
  isIntakeDataMessage,
  isUserAskingQuestion,
  relatesToSection,
  shouldRunGuidedIntake,
  tryDirectSectionAnswer,
} from "@/lib/section-qa";
import { checkTopicScope, type TopicId } from "@/lib/topic-scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getApiKey(): string | undefined {
  for (const name of ["OPENAI_API_KEY", "OPENAI_KEY", "OPEN_API_KEY"]) {
    const v = process.env[name];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

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

    const topic =
      body &&
      typeof body === "object" &&
      "topic" in body &&
      typeof (body as { topic: unknown }).topic === "string"
        ? (body as { topic: string }).topic
        : null;

    const userTurns = thread.filter((m) => m.role === "user");
    const lastUserContent = userTurns[userTurns.length - 1]?.content ?? "";
    const firstUserContent = userTurns[0]?.content ?? "";
    const activeTopic: TopicId =
      topic === "car-loan" || topic === "mortgage" || topic === "investment"
        ? topic
        : "investment";

    const incomingState =
      body && typeof body === "object" && "state" in body
        ? (body as { state?: unknown }).state
        : null;

    const carState = incomingState as CarLoanConversationState | null;
    const mortgageState = incomingState as MortgageConversationState | null;
    const inCarLoanFlow = isCarLoanFlowActive(carState);
    const inMortgageFlow = isMortgageFlowActive(mortgageState);

    const scopeReject = checkTopicScope(lastUserContent, activeTopic, {
      inActiveFlow:
        activeTopic === "car-loan"
          ? inCarLoanFlow
          : activeTopic === "mortgage"
            ? inMortgageFlow
            : activeTopic === "investment"
              ? Boolean(
                  incomingState &&
                    typeof incomingState === "object" &&
                    "stage" in (incomingState as object)
                )
              : false,
    });

    if (scopeReject) {
      return Response.json({
        answer: scopeReject.message,
        ...(scopeReject.preserveState && incomingState != null
          ? { state: incomingState }
          : {}),
      });
    }

    const direct = tryDirectSectionAnswer(lastUserContent, activeTopic);
    if (direct) {
      return Response.json({
        answer: direct.answer,
        ...(direct.preserveState && incomingState != null
          ? { state: incomingState }
          : {}),
      });
    }

    const inActiveFlow =
      activeTopic === "car-loan"
        ? inCarLoanFlow
        : activeTopic === "mortgage"
          ? inMortgageFlow
          : Boolean(
              incomingState &&
                typeof incomingState === "object" &&
                "stage" in (incomingState as object)
            );

    if (!shouldRunGuidedIntake(lastUserContent, inActiveFlow)) {
      const unknown = getUnknownDomainReply(activeTopic);
      return Response.json({
        answer: unknown.answer,
        state: incomingState ?? undefined,
      });
    }

    if (activeTopic === "car-loan") {
      const carQuick = handleCarLoanFlow(thread, carState, { forceTopic: true });
      if (carQuick) {
        return Response.json({ answer: carQuick.answer, state: carQuick.state });
      }
      return Response.json({
        answer:
          "This section only handles car loans under our three fixed rules (20% down, max 48-month term, ≤10% transportation). Share vehicle price, down payment, term, income, and monthly transport costs — or use **All topics** for Mortgage or Investment.",
        state: carState ?? undefined,
      });
    }

    if (activeTopic === "mortgage") {
      const mortgageQuick = handleMortgageFlow(thread, mortgageState, {
        forceTopic: true,
      });
      if (mortgageQuick) {
        return Response.json({
          answer: mortgageQuick.answer,
          state: mortgageQuick.state,
        });
      }
      return Response.json({
        answer:
          "This section only handles mortgages: **15- or 30-year** loans, **refinance when rate drops ≥1%**, **20% down + closing costs + emergency fund** before buying (otherwise rent), and **extra payoff** when rate >5%. Say if you are buying or refinancing, or share your numbers.",
        state: mortgageState ?? undefined,
      });
    }

    if (
      userTurns.length === 1 &&
      topic !== "investment" &&
      !isFinanceQuestion(firstUserContent)
    ) {
      return Response.json({
        answer:
          "Open **All topics** and choose **Investment**, **Car loan**, or **Mortgage**. We only answer those three — nothing else.",
      });
    }

    if (activeTopic === "investment") {
      const quick = handleConversationalFlow(
        thread,
        incomingState as ConversationState | null
      );
      if (quick) {
        return Response.json({ answer: quick.answer, state: quick.state });
      }
    }

    const unknown = getUnknownDomainReply(activeTopic);
    return Response.json({
      answer: unknown.answer,
      ...(incomingState != null ? { state: incomingState } : {}),
    });
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
