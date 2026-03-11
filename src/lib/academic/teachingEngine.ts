import Anthropic from "@anthropic-ai/sdk";
import type { Subject } from "@/types/academic-studio";

export type WorkspaceContext = "math" | "coding" | "paper" | "study";

export interface StudentAttempt {
  stepNumber: number;
  attempt: string;
  result: "correct" | "partial" | "wrong" | "skipped";
  timestamp: string;
}

export interface TeachingEngineRequest {
  content: string;
  subject: Subject;
  workspaceContext: WorkspaceContext;
  studentHistory: StudentAttempt[];
}

export interface SystemStep {
  stepNumber: number;
  title: string;
  instruction: string;
  hint: string;
  revealed: boolean;
  studentAttempts: StudentAttempt[];
  struggleDetected: boolean;
  conceptTag: string;
}

export interface TeachingEngineResponse {
  steps: SystemStep[];
  currentStepIndex: number;
  sessionId: string;
}

export interface VictorHandoffContext {
  workspaceContext: WorkspaceContext;
  subject: Subject;
  originalContent: string;
  stepsShown: SystemStep[];
  struggleStep: SystemStep;
  attemptsMade: StudentAttempt[];
  interventionReason: "button" | "auto";
}

type StepDecomposeRow = {
  stepNumber: number;
  title: string;
  instruction: string;
  hint: string;
  conceptTag: string;
};

const STEP_DECOMPOSE_PROMPT = `You are a teaching system. Your job is to break a problem or concept into clear, sequential steps that a student can work through one at a time.

Rules:
- Produce 3–6 steps depending on complexity
- Each step is one discrete unit of work or understanding
- Step 1 is the starting point — make it concrete and achievable
- Each step title is short: "Set up the equation", "Identify the pattern", "Apply the rule"
- Each step instruction is 1–3 sentences: enough to start, not enough to complete
- Each step hint is a single sentence that nudges without giving away the answer
- Each step has a conceptTag: the core concept being tested (e.g. "linear equations", "variable isolation", "thesis construction")

Workspace context adjusts behavior:
- math: precise, symbol-aware, show partial expressions not full solutions
- coding: show the pattern not the implementation, reference language-specific concepts
- paper: focus on structure and argument, not content
- study: focus on concept comprehension, not recall

Return ONLY valid JSON in this shape:
[
  {
    "stepNumber": 1,
    "title": "string",
    "instruction": "string",
    "hint": "string",
    "conceptTag": "string"
  }
]

No prose. No explanation. Only the JSON array.`;

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

function readAnthropicText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  for (const block of content) {
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
  }
  return "";
}

function parseJsonBlock(raw: string): unknown {
  const trimmed = raw.trim();
  const cleaned = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()
    : trimmed;
  return JSON.parse(cleaned);
}

function normalizeSteps(rows: StepDecomposeRow[]): SystemStep[] {
  const sorted = [...rows]
    .filter((row) => row && typeof row.stepNumber === "number")
    .sort((a, b) => a.stepNumber - b.stepNumber)
    .slice(0, 6);

  const clamped = sorted.length >= 3 ? sorted : [
    {
      stepNumber: 1,
      title: "Identify the core task",
      instruction: "Restate the problem in one precise sentence before solving.",
      hint: "Name what the problem is asking for.",
      conceptTag: "problem comprehension",
    },
    {
      stepNumber: 2,
      title: "Choose a method",
      instruction: "Select the rule, pattern, or structure you will use and justify it.",
      hint: "Pick the method that directly matches the problem type.",
      conceptTag: "method selection",
    },
    {
      stepNumber: 3,
      title: "Execute and check",
      instruction: "Carry out the method and validate the result against the prompt.",
      hint: "Check whether your result satisfies the original requirement.",
      conceptTag: "result validation",
    },
  ];

  return clamped.map((row, index) => ({
    stepNumber: index + 1,
    title: row.title || `Step ${index + 1}`,
    instruction: row.instruction || "Work this step with one clear transformation.",
    hint: row.hint || "Focus on one change at a time.",
    conceptTag: row.conceptTag || `step_${index + 1}`,
    revealed: index === 0,
    studentAttempts: [],
    struggleDetected: false,
  }));
}

export async function decomposeIntoSteps(
  request: TeachingEngineRequest
): Promise<SystemStep[]> {
  const apiKey = getClaudeApiKey();
  if (!apiKey) {
    return normalizeSteps([]);
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      temperature: 0.2,
      system: STEP_DECOMPOSE_PROMPT,
      messages: [
        {
          role: "user",
          content: `Subject: ${request.subject}\nWorkspace: ${request.workspaceContext}\nContent:\n${request.content}\n\nReturn JSON only.`,
        },
      ],
    });

    const text = readAnthropicText(response.content);
    const parsed = parseJsonBlock(text);
    if (!Array.isArray(parsed)) return normalizeSteps([]);

    const rows: StepDecomposeRow[] = parsed
      .map((item, index) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        return {
          stepNumber:
            typeof row.stepNumber === "number"
              ? Math.max(1, Math.floor(row.stepNumber))
              : index + 1,
          title: typeof row.title === "string" ? row.title.trim() : "",
          instruction:
            typeof row.instruction === "string" ? row.instruction.trim() : "",
          hint: typeof row.hint === "string" ? row.hint.trim() : "",
          conceptTag:
            typeof row.conceptTag === "string" ? row.conceptTag.trim() : "",
        };
      })
      .filter((row): row is StepDecomposeRow => Boolean(row));

    return normalizeSteps(rows);
  } catch {
    return normalizeSteps([]);
  }
}

export function detectStruggle(step: SystemStep, newAttempt: StudentAttempt): boolean {
  const attempts = [...step.studentAttempts, newAttempt];
  const substantiveNonCorrectCount = attempts.filter(
    (attempt) => attempt.result === "wrong" || attempt.result === "partial"
  ).length;
  return substantiveNonCorrectCount >= 2;
}

export function buildVictorHandoffContext(
  request: TeachingEngineRequest,
  steps: SystemStep[],
  struggleStepIndex: number,
  interventionReason: "button" | "auto"
): VictorHandoffContext {
  const step = steps[struggleStepIndex] || steps[Math.max(0, steps.length - 1)];
  const attemptsMade = [
    ...request.studentHistory,
    ...steps.flatMap((item) => item.studentAttempts),
  ];

  return {
    workspaceContext: request.workspaceContext,
    subject: request.subject,
    originalContent: request.content,
    stepsShown: steps,
    struggleStep: step,
    attemptsMade,
    interventionReason,
  };
}

export function formatHandoffForVictor(context: VictorHandoffContext): string {
  return `
SYSTEM CONTEXT — Student needs your help.

The teaching system already worked through this with the student. Here is the full picture:

Original problem: ${context.originalContent}
Subject: ${context.subject}
Workspace: ${context.workspaceContext}

Steps the system showed:
${context.stepsShown
  .map((step) => `Step ${step.stepNumber}: ${step.title} — ${step.instruction}`)
  .join("\n")}

Where the student got stuck:
Step ${context.struggleStep.stepNumber}: ${context.struggleStep.title}
Concept being tested: ${context.struggleStep.conceptTag}

What the student attempted at this step:
${context.attemptsMade
  .filter((attempt) => attempt.stepNumber === context.struggleStep.stepNumber)
  .map((attempt) => `— "${attempt.attempt}" (result: ${attempt.result})`)
  .join("\n")}

How Victor was triggered: ${
    context.interventionReason === "button"
      ? "Student asked for help directly"
      : "System detected repeated struggle"
  }

Your job: Pick up from Step ${context.struggleStep.stepNumber}. Do not repeat what the system already showed. Identify the exact misconception and re-teach at that level. Use your scaffolded teaching approach from this point forward.
`.trim();
}
