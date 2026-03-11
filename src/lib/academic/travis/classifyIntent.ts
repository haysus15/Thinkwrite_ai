import OpenAI from "openai";

export type IntentType =
  | "plan_assignment"
  | "build_week"
  | "rebalance"
  | "check_progress"
  | "check_risk"
  | "update_status"
  | "update_priority"
  | "schedule_tasks"
  | "ask_for_advice"
  | "express_stress"
  | "general_question"
  | "confirm"
  | "reject"
  | "unclear";

export type TravisHistoryMessage = {
  role: "user" | "travis" | "system";
  content: string;
  timestamp?: string;
};

export type AssignmentIntentContext = {
  id: string;
  assignment_name: string;
  class_name: string;
  status?: string | null;
  due_date?: string | null;
  is_at_risk?: boolean;
};

export type TravisIntent = {
  primaryIntent: IntentType;
  assignmentIds: string[];
  needsClarification: boolean;
  clarificationQuestion: string | null;
  confidence: "high" | "low";
};

function detectIntentHeuristic(
  userMessage: string,
  assignments: AssignmentIntentContext[]
): TravisIntent {
  const lower = userMessage.toLowerCase();

  const assignmentIds = assignments
    .filter((item) => lower.includes(item.assignment_name.toLowerCase()))
    .map((item) => item.id);

  if (/^(yes|yep|confirm|do it|apply it|sounds good)\b/.test(lower)) {
    return {
      primaryIntent: "confirm",
      assignmentIds,
      needsClarification: false,
      clarificationQuestion: null,
      confidence: "high",
    };
  }

  if (/\b(no|reject|dont|don't|adjust|change that)\b/.test(lower)) {
    return {
      primaryIntent: "reject",
      assignmentIds,
      needsClarification: false,
      clarificationQuestion: null,
      confidence: "high",
    };
  }

  if (/(overwhelmed|stressed|stress|panic|anxious|too much|can't keep up)/.test(lower)) {
    return {
      primaryIntent: "express_stress",
      assignmentIds,
      needsClarification: false,
      clarificationQuestion: null,
      confidence: "high",
    };
  }

  if (/(behind|replan|rebalance|catch up)/.test(lower)) {
    return {
      primaryIntent: "rebalance",
      assignmentIds,
      needsClarification: false,
      clarificationQuestion: null,
      confidence: "high",
    };
  }

  if (/(plan my week|schedule my week|week plan|this week)/.test(lower)) {
    return {
      primaryIntent: "build_week",
      assignmentIds,
      needsClarification: false,
      clarificationQuestion: null,
      confidence: "high",
    };
  }

  if (/(at risk|overdue|urgent|due today|due tomorrow|what's at risk|what is at risk)/.test(lower)) {
    return {
      primaryIntent: "check_risk",
      assignmentIds,
      needsClarification: false,
      clarificationQuestion: null,
      confidence: "high",
    };
  }

  if (/(progress|what's left|what is left|where am i|where am i at|done so far)/.test(lower)) {
    return {
      primaryIntent: "check_progress",
      assignmentIds,
      needsClarification: false,
      clarificationQuestion: null,
      confidence: "high",
    };
  }

  if (/(mark|set status|i'm done|im done|completed|finished)/.test(lower)) {
    return {
      primaryIntent: "update_status",
      assignmentIds,
      needsClarification: assignmentIds.length === 0,
      clarificationQuestion:
        assignmentIds.length === 0
          ? "Which assignment should I update?"
          : null,
      confidence: assignmentIds.length > 0 ? "high" : "low",
    };
  }

  if (/(should i|what would you do|is it realistic|which should i do first)/.test(lower)) {
    return {
      primaryIntent: "ask_for_advice",
      assignmentIds,
      needsClarification: false,
      clarificationQuestion: null,
      confidence: "high",
    };
  }

  if (/(plan|break down|schedule tasks|plan it)/.test(lower)) {
    return {
      primaryIntent: "plan_assignment",
      assignmentIds,
      needsClarification: assignmentIds.length === 0,
      clarificationQuestion:
        assignmentIds.length === 0
          ? "Which assignment should I plan?"
          : null,
      confidence: assignmentIds.length > 0 ? "high" : "low",
    };
  }

  return {
    primaryIntent: "general_question",
    assignmentIds,
    needsClarification: false,
    clarificationQuestion: null,
    confidence: "low",
  };
}

export async function classifyIntent(input: {
  userMessage: string;
  conversationHistory: TravisHistoryMessage[];
  assignments: AssignmentIntentContext[];
  pendingClarification?: { intent: IntentType; question: string } | null;
}): Promise<TravisIntent> {
  const message = input.userMessage.trim();
  if (!message) {
    return {
      primaryIntent: "unclear",
      assignmentIds: [],
      needsClarification: true,
      clarificationQuestion: "What do you want me to help with right now?",
      confidence: "low",
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return detectIntentHeuristic(message, input.assignments);
  }

  const assignmentSummary = input.assignments.slice(0, 50).map((item) => ({
    id: item.id,
    name: item.assignment_name,
    className: item.class_name,
    status: item.status ?? null,
    dueDate: item.due_date ?? null,
    atRisk: Boolean(item.is_at_risk),
  }));

  const recentHistory = input.conversationHistory.slice(-3).map((item) => ({
    role: item.role,
    content: item.content,
  }));

  const openai = new OpenAI({ apiKey });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Classify the student's planning intent for Travis. Return JSON only with keys: primaryIntent, assignmentIds, needsClarification, clarificationQuestion, confidence. Valid primaryIntent values: plan_assignment, build_week, rebalance, check_progress, check_risk, update_status, update_priority, schedule_tasks, ask_for_advice, express_stress, general_question, confirm, reject, unclear. If student references prior conversation (e.g., 'plan it'), use history context. Ask one clarification only when needed.",
        },
        {
          role: "user",
          content: JSON.stringify({
            userMessage: message,
            recentHistory,
            pendingClarification: input.pendingClarification ?? null,
            assignments: assignmentSummary,
          }),
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as Partial<TravisIntent>;

    const fallback = detectIntentHeuristic(message, input.assignments);
    const primaryIntent = parsed.primaryIntent;
    const validIntents: IntentType[] = [
      "plan_assignment",
      "build_week",
      "rebalance",
      "check_progress",
      "check_risk",
      "update_status",
      "update_priority",
      "schedule_tasks",
      "ask_for_advice",
      "express_stress",
      "general_question",
      "confirm",
      "reject",
      "unclear",
    ];

    const intent: IntentType =
      typeof primaryIntent === "string" && validIntents.includes(primaryIntent as IntentType)
        ? (primaryIntent as IntentType)
        : fallback.primaryIntent;

    return {
      primaryIntent: intent,
      assignmentIds: Array.isArray(parsed.assignmentIds)
        ? parsed.assignmentIds.filter((value): value is string => typeof value === "string")
        : fallback.assignmentIds,
      needsClarification:
        typeof parsed.needsClarification === "boolean"
          ? parsed.needsClarification
          : fallback.needsClarification,
      clarificationQuestion:
        typeof parsed.clarificationQuestion === "string"
          ? parsed.clarificationQuestion
          : fallback.clarificationQuestion,
      confidence: parsed.confidence === "high" ? "high" : "low",
    };
  } catch {
    return detectIntentHeuristic(message, input.assignments);
  }
}
