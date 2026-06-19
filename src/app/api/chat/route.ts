import {
  handleInvestmentChat,
  type ConversationState,
} from "@/lib/conversation";
import {
  assessCarLoanForm,
  assessInvestmentForm,
  assessMortgageForm,
} from "@/lib/form-assess";
import { FormSanityError } from "@/lib/form-sanity";
import type {
  CarLoanFormValues,
  InvestmentFormValues,
  MortgageFormValues,
} from "@/lib/form-types";
import {
  EDIT_NUMBERS_REPLY,
  FORM_FIRST_REPLY,
  wantsToChangeNumbers,
} from "@/lib/intake-session";
import {
  handleCarLoanFlow,
  inferCarLoanFlowFromThread,
  isCarLoanFlowActive,
  type CarLoanConversationState,
} from "@/lib/car-loan-flow";
import {
  handleMortgageFlow,
  isMortgageFlowActive,
  type MortgageConversationState,
} from "@/lib/mortgage-flow";
import {
  explainRuleQuestion,
  isConversationalNumericReply,
  prefersExplainerAnswer,
} from "@/lib/rule-explainer";
import {
  getUnknownDomainReply,
  isIntakeDataMessage,
  isUserAskingQuestion,
  tryDirectSectionAnswer,
} from "@/lib/section-qa";
import { finalizeAssistantReply } from "@/lib/conversation-guard";
import { checkTopicScope, type TopicId } from "@/lib/topic-scope";
import { explainCostlyMistake } from "@/lib/costly-mistakes/explainer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/chat — diagnostic endpoint.
 * This app is fully rule-based: answers come from fixed specs and math,
 * with no external AI model. Reported here so it's explicit.
 */
export async function GET() {
  return Response.json({
    mode: "rule-based",
    usesExternalAi: false,
    nodeEnv: process.env.NODE_ENV,
    vercel: process.env.VERCEL === "1",
  });
}

const MAX_MESSAGES = 60;

type ClientMsg = { role: "user" | "assistant"; content: string };

function chatResponse(
  thread: ClientMsg[],
  payload: { answer: string; state?: unknown },
  init?: ResponseInit
) {
  return Response.json(
    {
      ...payload,
      answer: finalizeAssistantReply(thread, payload.answer),
    },
    init
  );
}

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

    const topic =
      body &&
      typeof body === "object" &&
      "topic" in body &&
      typeof (body as { topic: unknown }).topic === "string"
        ? (body as { topic: string }).topic
        : null;

    const activeTopic: TopicId =
      topic === "car-loan" || topic === "mortgage" || topic === "investment"
        ? topic
        : "investment";

    const action =
      body && typeof body === "object" && "action" in body
        ? (body as { action: unknown }).action
        : null;

    if (topic === "costly-mistakes") {
      const mistakeTopic =
        body &&
        typeof body === "object" &&
        "mistakeTopic" in body &&
        typeof (body as { mistakeTopic: unknown }).mistakeTopic === "string"
          ? (body as { mistakeTopic: string }).mistakeTopic
          : null;
      const cmMessages = normalizeMessages(
        body && typeof body === "object" && "messages" in body
          ? (body as { messages: unknown }).messages
          : null
      );
      if (!mistakeTopic) {
        return Response.json(
          { answer: "Pick a topic first to ask about it." },
          { status: 400 }
        );
      }
      if (!cmMessages?.length) {
        return Response.json({ answer: "Please enter a message." });
      }
      const answer = explainCostlyMistake({
        topicId: mistakeTopic,
        thread: cmMessages.slice(-MAX_MESSAGES),
      });
      return Response.json({
        answer:
          answer ??
          "I couldn't find that topic. Go back and pick one from the list.",
      });
    }

    if (action === "submit-form") {
      const form =
        body && typeof body === "object" && "form" in body
          ? (body as { form: unknown }).form
          : null;
      if (!form || typeof form !== "object") {
        return Response.json(
          { answer: "Form data is missing. Please fill out the form and try again." },
          { status: 400 }
        );
      }

      const sanityAcknowledged: boolean =
        !!body &&
        typeof body === "object" &&
        "sanityAcknowledged" in body &&
        (body as { sanityAcknowledged: unknown }).sanityAcknowledged === true;

      try {
        if (activeTopic === "car-loan") {
          const result = assessCarLoanForm(form as CarLoanFormValues, { sanityAcknowledged });
          return Response.json({
            answer: result.answer,
            assessment: result.assessment,
            state: result.state,
            intakeComplete: true,
          });
        }
        if (activeTopic === "mortgage") {
          const result = assessMortgageForm(form as MortgageFormValues, { sanityAcknowledged });
          return Response.json({
            answer: result.answer,
            assessment: result.assessment,
            state: result.state,
            intakeComplete: true,
          });
        }
        if (activeTopic === "investment") {
          const result = assessInvestmentForm(form as InvestmentFormValues, {
            sanityAcknowledged,
          });
          return Response.json({
            answer: result.answer,
            assessment: result.assessment,
            state: result.state,
            intakeComplete: true,
          });
        }
      } catch (e) {
        if (e instanceof FormSanityError) {
          return Response.json({ answer: e.message }, { status: 400 });
        }
        return Response.json(
          {
            answer: `Could not run assessment: ${e instanceof Error ? e.message : String(e)}`,
          },
          { status: 400 }
        );
      }
      return Response.json(
        { answer: "Unknown topic for form submission." },
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
    const lastUserContent = userTurns[userTurns.length - 1]?.content ?? "";
    const incomingState =
      body && typeof body === "object" && "state" in body
        ? (body as { state?: unknown }).state
        : null;

    const carState = incomingState as CarLoanConversationState | null;
    const mortgageState = incomingState as MortgageConversationState | null;
    const investmentState = incomingState as ConversationState | null;
    const carIntakeComplete = Boolean(carState?.intakeComplete);
    const mortgageIntakeComplete = Boolean(mortgageState?.intakeComplete);
    const investmentIntakeComplete = Boolean(investmentState?.intakeComplete);
    const inCarLoanFlow =
      isCarLoanFlowActive(carState) || inferCarLoanFlowFromThread(thread);
    const inMortgageFlow = isMortgageFlowActive(mortgageState);

    const scopeReject = checkTopicScope(lastUserContent, activeTopic, {
      inActiveFlow:
        activeTopic === "car-loan"
          ? inCarLoanFlow
          : activeTopic === "mortgage"
            ? inMortgageFlow
            : activeTopic === "investment"
              ? investmentIntakeComplete ||
                Boolean(
                  incomingState &&
                    typeof incomingState === "object" &&
                    "stage" in (incomingState as object)
                )
              : false,
    });

    if (scopeReject) {
      return chatResponse(thread, {
        answer: scopeReject.message,
        ...(scopeReject.preserveState && incomingState != null
          ? { state: incomingState }
          : {}),
      });
    }

    if (wantsToChangeNumbers(lastUserContent)) {
      const intakeDone =
        (activeTopic === "car-loan" && carIntakeComplete) ||
        (activeTopic === "mortgage" && mortgageIntakeComplete) ||
        (activeTopic === "investment" && investmentIntakeComplete);
      if (intakeDone) {
        return chatResponse(thread, {
          answer: EDIT_NUMBERS_REPLY,
          state: incomingState ?? undefined,
        });
      }
    }

    const intakeCompleteForTopic =
      activeTopic === "car-loan"
        ? carIntakeComplete
        : activeTopic === "mortgage"
          ? mortgageIntakeComplete
          : investmentIntakeComplete;

    if (intakeCompleteForTopic) {
      if (
        isIntakeDataMessage(lastUserContent, true, { intakeComplete: true }) &&
        !isUserAskingQuestion(lastUserContent)
      ) {
        return chatResponse(thread, {
          answer: EDIT_NUMBERS_REPLY,
          state: incomingState ?? undefined,
        });
      }

      const wantsExplain =
        prefersExplainerAnswer(lastUserContent, activeTopic) ||
        isConversationalNumericReply(lastUserContent, thread);

      const direct = tryDirectSectionAnswer(lastUserContent, activeTopic);

      if (!wantsExplain && direct) {
        return chatResponse(thread, {
          answer: direct.answer,
          state: incomingState ?? undefined,
        });
      }

      if (wantsExplain || (isUserAskingQuestion(lastUserContent) && !direct)) {
        const explained = explainRuleQuestion({
          topic: activeTopic,
          thread,
          state: incomingState,
        });
        if (explained) {
          return chatResponse(thread, {
            answer: explained,
            state: incomingState ?? undefined,
          });
        }
      }

      if (direct) {
        return chatResponse(thread, {
          answer: direct.answer,
          state: incomingState ?? undefined,
        });
      }

      if (activeTopic === "car-loan") {
        const carQuick = handleCarLoanFlow(thread, carState, { forceTopic: true });
        if (carQuick) {
          return chatResponse(thread, {
            answer: carQuick.answer,
            state: carQuick.state,
          });
        }
      }
      if (activeTopic === "mortgage") {
        const mortgageQuick = handleMortgageFlow(thread, mortgageState, {
          forceTopic: true,
        });
        if (mortgageQuick) {
          return chatResponse(thread, {
            answer: mortgageQuick.answer,
            state: mortgageQuick.state,
          });
        }
      }
      if (activeTopic === "investment") {
        const invQuick = handleInvestmentChat(thread, investmentState);
        if (invQuick) {
          return chatResponse(thread, {
            answer: invQuick.answer,
            state: invQuick.state,
          });
        }
      }

      const unknown = getUnknownDomainReply(activeTopic);
      return chatResponse(thread, {
        answer: unknown.answer,
        state: incomingState ?? undefined,
      });
    }

    if (!intakeCompleteForTopic) {
      const direct = tryDirectSectionAnswer(lastUserContent, activeTopic);
      if (direct) {
        return chatResponse(thread, {
          answer: direct.answer,
        });
      }
      return chatResponse(thread, {
        answer: FORM_FIRST_REPLY[activeTopic],
      });
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
