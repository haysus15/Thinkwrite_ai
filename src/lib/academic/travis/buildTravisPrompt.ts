import { TRAVIS_SYSTEM_PROMPT } from "@/lib/academic/travisAi";
import type { AssignmentRow } from "@/types/academic-studio";
import { buildAgendaContext } from "./buildAgendaContext";
import type { TravisIntent, TravisHistoryMessage } from "./classifyIntent";
import { TRAVIS_CONVERSATION_BLOCK, TRAVIS_STRESS_BLOCK } from "./travisConversationBlock";

export const MAX_HISTORY_TURNS = 10;

export type ClaudeMessage = {
  role: "user" | "assistant";
  content: string;
};

export function buildTravisMessages(input: {
  userMessage: string;
  conversationHistory: TravisHistoryMessage[];
  agendaItems: AssignmentRow[];
  intent: TravisIntent;
  stressMode: boolean;
}): { systemPrompt: string; messages: ClaudeMessage[] } {
  const systemPrompt = [
    TRAVIS_SYSTEM_PROMPT,
    TRAVIS_CONVERSATION_BLOCK,
    input.stressMode ? TRAVIS_STRESS_BLOCK : "",
    buildAgendaContext({ items: input.agendaItems, currentDate: new Date() }),
    `INTENT: ${input.intent.primaryIntent}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const historyMessages: ClaudeMessage[] = input.conversationHistory
    .slice(-MAX_HISTORY_TURNS)
    .map((message) => ({
      role: message.role === "travis" ? "assistant" : "user",
      content:
        message.role === "system"
          ? `System note: ${message.content}`
          : message.content,
    }));

  const messages: ClaudeMessage[] = [
    ...historyMessages,
    { role: "user", content: input.userMessage },
  ];

  return { systemPrompt, messages };
}
