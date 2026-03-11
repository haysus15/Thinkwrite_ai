import Anthropic from "@anthropic-ai/sdk";
import { detectAnswerRequest, detectStuck, detectWorkShown } from "./victorContextBuilder";
import { VICTOR_INTEGRITY_BLOCK } from "./victor/victorIntegrity";

type VictorHistoryItem = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (
        block &&
        typeof block === "object" &&
        "type" in block &&
        (block as { type?: string }).type === "text" &&
        "text" in block &&
        typeof (block as { text?: unknown }).text === "string"
      ) {
        return (block as { text: string }).text;
      }
      return "";
    })
    .join("\n")
    .trim();
}

export function readAnthropicText(response: { content?: unknown }) {
  return extractText(response.content);
}

async function verifyMathWork(
  anthropic: Anthropic,
  problem: string,
  studentWork: string,
  systemPrefix?: string
) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    system: `${systemPrefix ? `${systemPrefix}\n\n` : ""}You are evaluating a student's math work step-by-step.
Return JSON: {
  "problemType": "derivative|integral|algebra|geometry|other",
  "steps": [
    {
      "stepNumber": 1,
      "studentWork": "what they wrote",
      "isCorrect": true/false,
      "errorType": "arithmetic|conceptual|procedural|notation",
      "feedback": "specific feedback for this step"
    }
  ],
  "finalAnswerCorrect": true/false,
  "conceptsUsed": ["power rule"],
  "suggestedPractice": "A similar problem"
}

${VICTOR_INTEGRITY_BLOCK}`,
    messages: [
      {
        role: "user",
        content: `PROBLEM: ${problem}\n\nSTUDENT'S WORK:\n${studentWork}\n\nVerify each step.`,
      },
    ],
  });

  return JSON.parse(readAnthropicText(response) || "{}");
}

async function generatePracticeProblem(
  anthropic: Anthropic,
  problem: string,
  conceptsUsed: string[],
  systemPrefix?: string
) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    system: `${systemPrefix ? `${systemPrefix}\n\n` : ""}Generate only a practice problem prompt.
Do not provide a complete worked solution.

${VICTOR_INTEGRITY_BLOCK}`,
    messages: [
      {
        role: "user",
        content: `Generate a similar practice problem to:\n"${problem}"\nConcepts: ${conceptsUsed.join(
          ", "
        )}\nReturn only the problem.`,
      },
    ],
  });
  return readAnthropicText(response).trim() || "";
}

export async function handleMathMode(params: {
  anthropic: Anthropic;
  supabase: any;
  currentId: string;
  userId: string;
  message: string;
  history: VictorHistoryItem[];
  persistedMode: string;
  systemPrefix?: string;
}) {
  const {
    anthropic,
    supabase,
    currentId,
    userId,
    message,
    history,
    persistedMode,
    systemPrefix,
  } =
    params;

  const workShown = detectWorkShown(message);
  const askingForAnswer = detectAnswerRequest(message);
  const isStuck = detectStuck(message);

  const { data: session } = await supabase
    .from("math_sessions")
    .select("*")
    .eq("conversation_id", currentId)
    .eq("user_id", userId)
    .eq("completed", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let mathSession = session;
  if (!mathSession) {
    const { data: created } = await supabase
      .from("math_sessions")
      .insert({
        user_id: userId,
        conversation_id: currentId,
        problem_text: message,
        student_work: [],
        completed: false,
      })
      .select("*")
      .single();
    mathSession = created;
  }

  let reply = "";

  if (!workShown) {
    if (askingForAnswer) {
      reply =
        "That's not how this works. Show me your attempt, and I'll help you find where you're stuck.";
    } else if (isStuck) {
      reply =
        "Let's break it down. What type of problem is this, and what rule would you start with?";
    } else {
      reply =
        "Show me what you've tried so far. What formula or method would you start with?";
    }
  } else {
    const verification = await verifyMathWork(
      anthropic,
      mathSession.problem_text,
      message,
      systemPrefix
    );
    const firstError = (verification.steps || []).find(
      (step: any) => !step.isCorrect
    );

    if (firstError) {
      reply = `Let's pause at step ${firstError.stepNumber}. ${firstError.feedback || "Check the rule you're applying."} What should that step look like?`;
    } else if (verification.finalAnswerCorrect) {
      const practice = await generatePracticeProblem(
        anthropic,
        mathSession.problem_text,
        verification.conceptsUsed || [],
        systemPrefix
      );
      reply = `Good. Your steps are solid. Want to try a similar problem?\n${practice}`;
    } else {
      reply =
        "Your steps look consistent, but the final answer doesn't match. Re-check the last step and tell me what you find.";
    }

    await supabase
      .from("math_sessions")
      .update({
        student_work: verification.steps || [],
        verification_results: verification,
        problem_type: verification.problemType || null,
        concepts_used: verification.conceptsUsed || null,
        final_answer_correct: verification.finalAnswerCorrect || false,
        completed: Boolean(verification.finalAnswerCorrect),
        completed_at: verification.finalAnswerCorrect ? new Date().toISOString() : null,
      })
      .eq("id", mathSession.id)
      .eq("user_id", userId);
  }

  const nextHistory = [
    ...history,
    { role: "user" as const, content: message, timestamp: new Date().toISOString() },
    { role: "assistant" as const, content: reply, timestamp: new Date().toISOString() },
  ];

  await supabase
    .from("victor_conversations")
    .update({
      messages: nextHistory,
      last_message_at: new Date().toISOString(),
      mode: persistedMode,
    })
    .eq("id", currentId)
    .eq("user_id", userId);

  return {
    reply,
    conversationId: currentId,
    suggestedMode: null,
    requiresConfirmation: false,
  };
}
