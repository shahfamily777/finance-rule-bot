/**
 * Educational explainer for the "Avoid Costly Mistakes" module.
 * Calm, neutral, never accusatory. Explains costs, tradeoffs, incentives,
 * and alternatives. Behavior spec: specs/costly-mistakes.yaml
 */
import { costlyMistakesSpec } from "@/lib/specs";
import type { CostlyMistakeTopic } from "@/lib/specs";
import { getCostlyMistakeTopic } from "@/lib/costly-mistakes";

export type ExplainThreadMsg = { role: "user" | "assistant"; content: string };

const spec = costlyMistakesSpec;

function topicKnowledgeBlock(topic: CostlyMistakeTopic): string {
  const list = (items: string[]) => items.map((i) => `- ${i}`).join("\n");
  return `TOPIC: ${topic.name}
What it is: ${topic.what_is_it.trim()}

Why people buy it:
${list(topic.why_people_buy)}

Costs and tradeoffs:
${list(topic.costs)}

Who actually benefits:
${list(topic.who_benefits)}

Lower-cost alternatives:
${list(topic.alternatives)}

Good questions to ask before buying:
${list(topic.questions_to_ask)}`;
}

export function buildCostlyMistakesSystemPrompt(topic: CostlyMistakeTopic): string {
  return `You are the educational layer of "Finance Rules" for the **Avoid Costly Mistakes** module.

MISSION: ${spec.intro.trim()}

PRINCIPLE: ${spec.principle.trim()}

YOU SHOULD:
${spec.ai.should.map((s) => `- ${s}`).join("\n")}

YOU MUST NOT:
${spec.ai.should_not.map((s) => `- ${s}`).join("\n")}

TONE: ${spec.ai.tone.join(", ")}.
Example — avoid: "${spec.ai.example_style.avoid}" → use: "${spec.ai.example_style.use}".

OUTPUT STYLE:
- Keep responses short and clear (usually 2-4 short paragraphs).
- Use bold sparingly, for key numbers or terms only.
- Never call anything a scam, fraud, or rip-off. Explain costs and tradeoffs instead.
- The goal is that the user leaves understanding the decision better — not pressured.

---
${topicKnowledgeBlock(topic)}
---

Answer the user's question using only the knowledge above and general, well-established
financial concepts. If asked something outside this topic or this module, gently steer
back to understanding ${topic.name}. End nothing with a hard recommendation — help them
decide clearly. Always remember: ${spec.disclaimer}`;
}

/** Deterministic answer when no API key is configured. */
export function fallbackCostlyMistakesAnswer(
  topic: CostlyMistakeTopic,
  userMessage: string
): string {
  const t = userMessage.toLowerCase();
  const bullets = (items: string[]) => items.map((i) => `• ${i}`).join("\n");

  if (/\b(cost|fee|expensive|charge|price|how much)\b/.test(t)) {
    return `Here are the main costs and tradeoffs of **${topic.name}**:\n\n${bullets(
      topic.costs
    )}\n\n${spec.disclaimer}`;
  }
  if (/\b(alternative|instead|cheaper|other option|better)\b/.test(t)) {
    return `Lower-cost alternatives worth comparing for **${topic.name}**:\n\n${bullets(
      topic.alternatives
    )}\n\n${spec.disclaimer}`;
  }
  if (/\b(who|benefit|good for|right for|should i)\b/.test(t)) {
    return `Who genuinely benefits from **${topic.name}**:\n\n${bullets(
      topic.who_benefits
    )}\n\n${spec.disclaimer}`;
  }
  if (/\b(why|reason|appeal|sold|pitch)\b/.test(t)) {
    return `Why people buy **${topic.name}**:\n\n${bullets(
      topic.why_people_buy
    )}\n\n${spec.disclaimer}`;
  }
  if (/\b(ask|question|before|due diligence|check)\b/.test(t)) {
    return `Good questions to ask before committing to **${topic.name}**:\n\n${bullets(
      topic.questions_to_ask
    )}\n\n${spec.disclaimer}`;
  }
  if (/\b(what is|what are|explain|how does|tell me about)\b/.test(t)) {
    return `**${topic.name}** — ${topic.what_is_it.trim()}\n\n${spec.disclaimer}`;
  }

  return `Here's a quick orientation on **${topic.name}**:\n\n${topic.what_is_it.trim()}\n\nMain tradeoffs:\n${bullets(
    topic.costs.slice(0, 3)
  )}\n\nAsk about the costs, who benefits, alternatives, or questions to ask. ${spec.disclaimer}`;
}

export async function explainCostlyMistake(params: {
  topicId: string;
  thread: ExplainThreadMsg[];
  apiKey?: string;
}): Promise<string | null> {
  const { topicId, thread, apiKey } = params;
  const topic = getCostlyMistakeTopic(topicId);
  if (!topic) return null;

  const userMessage =
    [...thread].reverse().find((m) => m.role === "user")?.content ?? "";
  if (!userMessage.trim()) return null;

  const fallback = fallbackCostlyMistakesAnswer(topic, userMessage);
  if (!apiKey) return fallback;

  const recent = thread
    .slice(-8)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  const system = buildCostlyMistakesSystemPrompt(topic);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 450,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Recent conversation:\n${recent}\n\nReply to the user's latest message about ${topic.name}. Stay calm, neutral, and educational — never call it a scam.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error(
        "[costly-mistakes] OpenAI error",
        res.status,
        await res.text()
      );
      return fallback;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    return content && content.length > 0 ? content : fallback;
  } catch (e) {
    console.error("[costly-mistakes]", e);
    return fallback;
  }
}
