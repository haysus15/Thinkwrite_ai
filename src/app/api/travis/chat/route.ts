import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildTravisMessages,
  type ClaudeMessage,
} from "@/lib/academic/travis/buildTravisPrompt";
import {
  classifyIntent,
  type AssignmentIntentContext,
  type IntentType,
  type TravisHistoryMessage,
} from "@/lib/academic/travis/classifyIntent";
import type { AssignmentRow } from "@/types/academic-studio";

type PendingClarification = {
  intent: IntentType;
  question: string;
  context: Record<string, unknown>;
} | null;

type PendingAction = {
  type:
    | "plan_assignment"
    | "build_week"
    | "rebalance"
    | "update_status"
    | "update_priority"
    | "schedule_tasks"
    | "flag_risk"
    | "check_progress"
    | "check_risk"
    | "none";
  assignmentIds: string[];
  taskIds: string[];
  summary: string;
  confirmed: boolean;
  confirmedAt: string | null;
  context?: Record<string, unknown>;
} | null;

type ChatRequestBody = {
  message?: string;
  assignmentId?: string;
  confirm?: boolean;
  reject?: boolean;
  conversationHistory?: TravisHistoryMessage[];
  pendingClarification?: PendingClarification;
  pendingAction?: PendingAction;
};

function parseStatusFromMessage(message: string):
  | "inbox"
  | "planned"
  | "in_progress"
  | "ready_to_submit"
  | "submitted"
  | "completed"
  | null {
  const lower = message.toLowerCase();
  if (/(done|finished|complete|completed|submitted)/.test(lower)) return "completed";
  if (/(ready to submit)/.test(lower)) return "ready_to_submit";
  if (/(in progress|started|working on)/.test(lower)) return "in_progress";
  if (/(planned|plan it|schedule it)/.test(lower)) return "planned";
  if (/(inbox|not started)/.test(lower)) return "inbox";
  return null;
}

function daysUntilDue(dueDate: string | null | undefined): number {
  if (!dueDate) return Number.POSITIVE_INFINITY;
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function computeAtRisk(assignment: {
  status?: string | null;
  due_date?: string | null;
  assignment_tasks?: Array<{ status?: string | null }>;
}): boolean {
  const status = assignment.status || "inbox";
  const dueIn = daysUntilDue(assignment.due_date || null);
  const tasks = Array.isArray(assignment.assignment_tasks)
    ? assignment.assignment_tasks
    : [];
  const incomplete = tasks.filter((task) => task.status !== "complete").length;
  if (dueIn <= 3 && incomplete > 1) return true;
  if (dueIn <= 5 && (status === "inbox" || status === "planned")) return true;
  return false;
}

async function callToolRoute(input: {
  request: NextRequest;
  endpoint: string;
  payload: Record<string, unknown>;
}) {
  const toolResponse = await fetch(new URL(input.endpoint, input.request.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: input.request.headers.get("cookie") || "",
    },
    body: JSON.stringify(input.payload),
    cache: "no-store",
  });

  const data = await toolResponse.json().catch(() => ({}));
  return {
    ok: toolResponse.ok,
    status: toolResponse.status,
    data,
  };
}

async function runTravisClaudeConversation(input: {
  userMessage: string;
  conversationHistory: TravisHistoryMessage[];
  assignments: AssignmentRow[];
  intent: Awaited<ReturnType<typeof classifyIntent>>;
  stressMode: boolean;
  extraContext?: string;
}): Promise<string> {
  const apiKey =
    process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || null;
  if (!apiKey) {
    return "I can map your workload, but Claude API access is required for conversational output.";
  }

  const anthropic = new Anthropic({ apiKey });
  const messageWithContext = input.extraContext
    ? `${input.userMessage}\n\n${input.extraContext}`
    : input.userMessage;

  const { systemPrompt, messages } = buildTravisMessages({
    userMessage: messageWithContext,
    conversationHistory: input.conversationHistory,
    agendaItems: input.assignments,
    intent: input.intent,
    stressMode: input.stressMode,
  });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 900,
    system: systemPrompt,
    messages: messages as ClaudeMessage[],
  });

  const content = response.content;
  if (!Array.isArray(content)) return "I mapped the workload. Want me to act on it?";
  for (const block of content) {
    if (block && typeof block === "object" && "type" in block && block.type === "text") {
      const text = (block as { text?: string }).text;
      if (typeof text === "string" && text.trim()) {
        return text.trim();
      }
    }
  }
  return "I mapped the workload. Want me to act on it?";
}

function mapAssignments(data: unknown): AssignmentRow[] {
  if (!Array.isArray(data)) return [];
  return data as AssignmentRow[];
}

export async function POST(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as ChatRequestBody;
  const message = String(body?.message || "").trim();

  if (!message) {
    return NextResponse.json(
      { success: false, error: "message is required." },
      { status: 400 }
    );
  }

  const incomingHistory = Array.isArray(body.conversationHistory)
    ? body.conversationHistory
        .filter(
          (item): item is TravisHistoryMessage =>
            !!item &&
            (item.role === "user" || item.role === "travis" || item.role === "system") &&
            typeof item.content === "string"
        )
        .slice(-10)
    : [];

  const pendingClarification =
    body.pendingClarification && typeof body.pendingClarification === "object"
      ? body.pendingClarification
      : null;
  const pendingAction =
    body.pendingAction && typeof body.pendingAction === "object"
      ? body.pendingAction
      : null;

  const supabase = await createSupabaseServerClient();
  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("assignments")
    .select(
      "id, assignment_name, class_name, due_date, status, priority, assignment_tasks(id, status, planned_date, completed_at, task_type, label, sort_order)"
    )
    .eq("user_id", userId)
    .is("archived_at", null);

  if (assignmentError) {
    return NextResponse.json(
      { success: false, error: assignmentError.message || "Failed to load assignments." },
      { status: 500 }
    );
  }

  const assignments = mapAssignments(assignmentRows).map((item) => ({
    ...item,
    tasks: item.assignment_tasks || [],
    is_at_risk: computeAtRisk(item),
  }));

  const assignmentIntentContext: AssignmentIntentContext[] = assignments.map((item) => ({
    id: item.id,
    assignment_name: item.assignment_name,
    class_name: item.class_name,
    status: item.status,
    due_date: item.due_date,
    is_at_risk: item.is_at_risk,
  }));

  const intent = await classifyIntent({
    userMessage: message,
    conversationHistory: incomingHistory,
    assignments: assignmentIntentContext,
    pendingClarification,
  });

  if (body.reject || intent.primaryIntent === "reject") {
    return NextResponse.json(
      {
        success: true,
        message: "Understood. What do you want me to adjust?",
        pendingAction: null,
        pendingClarification: null,
      },
      { status: 200 }
    );
  }

  const executePendingAction = async (action: PendingAction) => {
    if (!action) return null;

    if (action.type === "update_status") {
      const assignmentId = action.assignmentIds[0];
      const status =
        typeof action.context?.status === "string"
          ? action.context.status
          : "in_progress";
      if (!assignmentId) return null;
      const response = await fetch(
        new URL(`/api/travis/assignment/update/${assignmentId}`, request.url),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Cookie: request.headers.get("cookie") || "",
          },
          body: JSON.stringify({ status }),
          cache: "no-store",
        }
      );
      const data = await response.json().catch(() => ({}));
      return {
        ok: response.ok,
        status: response.status,
        data,
      };
    }

    const endpointByType: Record<string, string> = {
      plan_assignment: "/api/travis/plan-assignment",
      build_week: "/api/travis/build-week",
      rebalance: "/api/travis/rebalance",
      check_progress: "/api/travis/progress",
    };

    const endpoint = endpointByType[action.type];
    if (!endpoint) return null;

    const payload = {
      confirm: true,
      assignmentId: action.assignmentIds[0],
      ...(action.context || {}),
    };

    return callToolRoute({ request, endpoint, payload });
  };

  if (body.confirm || intent.primaryIntent === "confirm") {
    if (!pendingAction) {
      return NextResponse.json(
        {
          success: true,
          message: "I do not have a pending proposal to confirm yet.",
          pendingAction: null,
          pendingClarification: null,
        },
        { status: 200 }
      );
    }

    const applied = await executePendingAction(pendingAction);
    if (applied && !applied.ok) {
      return NextResponse.json(
        {
          success: false,
          error: String(applied.data?.error || "Could not apply the proposal."),
          pendingAction,
          pendingClarification: null,
        },
        { status: applied.status || 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          pendingAction.type === "update_status"
            ? "Done. I updated the assignment status."
            : String(applied?.data?.message || "Done. I applied the plan."),
        pendingAction: null,
        pendingClarification: null,
      },
      { status: 200 }
    );
  }

  const explicitAssignmentId =
    typeof body.assignmentId === "string" && body.assignmentId.trim()
      ? body.assignmentId.trim()
      : null;

  const resolvedAssignmentId =
    intent.assignmentIds[0] ||
    explicitAssignmentId ||
    (typeof pendingClarification?.context?.assignmentId === "string"
      ? pendingClarification.context.assignmentId
      : null);

  if (intent.needsClarification || intent.primaryIntent === "unclear") {
    const question =
      intent.clarificationQuestion ||
      "Which assignment should I work with?";

    const clarification: PendingClarification = {
      intent: intent.primaryIntent,
      question,
      context: {
        ...(pendingClarification?.context || {}),
      },
    };

    const clarifyingMessage = await runTravisClaudeConversation({
      userMessage: question,
      conversationHistory: incomingHistory,
      assignments,
      intent,
      stressMode: false,
    });

    return NextResponse.json(
      {
        success: true,
        message: clarifyingMessage,
        pendingAction: null,
        pendingClarification: clarification,
      },
      { status: 200 }
    );
  }

  if (intent.primaryIntent === "express_stress") {
    const overdue = assignments.filter((item) => daysUntilDue(item.due_date) < 0);
    const within24h = assignments.filter((item) => {
      const due = daysUntilDue(item.due_date);
      return due >= 0 && due <= 1;
    });
    const atRisk = assignments.filter((item) => item.is_at_risk);

    const urgent = overdue[0] || within24h[0] || atRisk[0] || assignments[0] || null;
    const triageContext = [
      `TRIAGE SNAPSHOT: overdue=${overdue.length}, due_within_24h=${within24h.length}, at_risk=${atRisk.length}`,
      urgent
        ? `MOST URGENT: ${urgent.assignment_name} (${urgent.class_name}) due ${urgent.due_date || "no due date"}`
        : "MOST URGENT: none",
      "Offer one next action and ask if the student wants you to execute it.",
    ].join("\n");

    const messageText = await runTravisClaudeConversation({
      userMessage: message,
      conversationHistory: incomingHistory,
      assignments,
      intent,
      stressMode: true,
      extraContext: triageContext,
    });

    const nextPendingAction: PendingAction = urgent
      ? {
          type: "plan_assignment",
          assignmentIds: [urgent.id],
          taskIds: [],
          summary: `Break down ${urgent.assignment_name} into immediate tasks.`,
          confirmed: false,
          confirmedAt: null,
          context: { assignmentId: urgent.id },
        }
      : null;

    return NextResponse.json(
      {
        success: true,
        message: messageText,
        pendingAction: nextPendingAction,
        pendingClarification: null,
      },
      { status: 200 }
    );
  }

  if (intent.primaryIntent === "plan_assignment") {
    if (!resolvedAssignmentId) {
      return NextResponse.json(
        {
          success: true,
          message: "Which assignment should I plan?",
          pendingAction: null,
          pendingClarification: {
            intent: "plan_assignment",
            question: "Which assignment should I plan?",
            context: {},
          },
        },
        { status: 200 }
      );
    }

    const tool = await callToolRoute({
      request,
      endpoint: "/api/travis/plan-assignment",
      payload: { assignmentId: resolvedAssignmentId, confirm: false },
    });

    if (!tool.ok) {
      return NextResponse.json(
        { success: false, error: String(tool.data?.error || "Planning failed.") },
        { status: tool.status || 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: String(tool.data?.message || "I drafted a plan. Confirm to apply."),
        pendingAction: {
          type: "plan_assignment",
          assignmentIds: [resolvedAssignmentId],
          taskIds: [],
          summary: "Apply this assignment task plan.",
          confirmed: false,
          confirmedAt: null,
          context: { assignmentId: resolvedAssignmentId },
        },
        pendingClarification: null,
      },
      { status: 200 }
    );
  }

  if (intent.primaryIntent === "build_week") {
    const tool = await callToolRoute({
      request,
      endpoint: "/api/travis/build-week",
      payload: { confirm: false },
    });

    if (!tool.ok) {
      return NextResponse.json(
        { success: false, error: String(tool.data?.error || "Weekly plan failed.") },
        { status: tool.status || 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: String(tool.data?.message || "I drafted this weekly plan. Confirm to apply."),
        pendingAction: {
          type: "build_week",
          assignmentIds: [],
          taskIds: [],
          summary: "Apply this weekly schedule.",
          confirmed: false,
          confirmedAt: null,
          context: {},
        },
        pendingClarification: null,
      },
      { status: 200 }
    );
  }

  if (intent.primaryIntent === "rebalance") {
    const tool = await callToolRoute({
      request,
      endpoint: "/api/travis/rebalance",
      payload: { confirm: false },
    });

    if (!tool.ok) {
      return NextResponse.json(
        { success: false, error: String(tool.data?.error || "Rebalance failed.") },
        { status: tool.status || 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: String(tool.data?.message || "I drafted a rebalance plan. Confirm to apply."),
        pendingAction: {
          type: "rebalance",
          assignmentIds: [],
          taskIds: [],
          summary: "Apply this rebalance plan.",
          confirmed: false,
          confirmedAt: null,
          context: {},
        },
        pendingClarification: null,
      },
      { status: 200 }
    );
  }

  if (intent.primaryIntent === "check_progress") {
    const tool = await callToolRoute({
      request,
      endpoint: "/api/travis/progress",
      payload: {},
    });

    if (!tool.ok) {
      return NextResponse.json(
        { success: false, error: String(tool.data?.error || "Progress check failed.") },
        { status: tool.status || 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: String(tool.data?.message || "Here is your progress summary."),
        pendingAction: null,
        pendingClarification: null,
      },
      { status: 200 }
    );
  }

  if (intent.primaryIntent === "check_risk") {
    const atRisk = assignments.filter((item) => item.is_at_risk);
    const overdue = assignments.filter((item) => daysUntilDue(item.due_date) < 0);
    const riskSummary = [
      `RISK SUMMARY: overdue=${overdue.length}, at_risk=${atRisk.length}`,
      ...atRisk.slice(0, 5).map((item) => `- ${item.assignment_name} (${item.class_name})`),
    ].join("\n");

    const text = await runTravisClaudeConversation({
      userMessage: message,
      conversationHistory: incomingHistory,
      assignments,
      intent,
      stressMode: false,
      extraContext: riskSummary,
    });

    return NextResponse.json(
      {
        success: true,
        message: text,
        pendingAction: null,
        pendingClarification: null,
      },
      { status: 200 }
    );
  }

  if (intent.primaryIntent === "update_status") {
    const status = parseStatusFromMessage(message);
    if (!resolvedAssignmentId || !status) {
      return NextResponse.json(
        {
          success: true,
          message:
            "I can update that, but I need the assignment and target status. Which assignment should I set, and to what status?",
          pendingAction: null,
          pendingClarification: {
            intent: "update_status",
            question:
              "Which assignment should I update, and what status should I set?",
            context: {},
          },
        },
        { status: 200 }
      );
    }

    const assignment = assignments.find((item) => item.id === resolvedAssignmentId);
    return NextResponse.json(
      {
        success: true,
        message: `I can set ${assignment?.assignment_name || "that assignment"} to ${status}. Confirm and I will apply it.`,
        pendingAction: {
          type: "update_status",
          assignmentIds: [resolvedAssignmentId],
          taskIds: [],
          summary: `Set assignment status to ${status}.`,
          confirmed: false,
          confirmedAt: null,
          context: { status },
        },
        pendingClarification: null,
      },
      { status: 200 }
    );
  }

  const conversational = await runTravisClaudeConversation({
    userMessage: message,
    conversationHistory: incomingHistory,
    assignments,
    intent,
    stressMode: false,
  });

  return NextResponse.json(
    {
      success: true,
      message: conversational,
      pendingAction: null,
      pendingClarification: null,
    },
    { status: 200 }
  );
}
