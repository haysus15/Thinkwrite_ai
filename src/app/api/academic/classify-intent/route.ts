import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import type { AssignmentRow } from "@/types/academic";
import {
  classifyIntent as classifyTravisIntent,
  type AssignmentIntentContext,
} from "@/lib/academic/travis/classifyIntent";
import type { AcademicIntentResult } from "@/components/academic/chat/chatTypes";

type RequestBody = {
  message?: string;
  existingAssignments?: Array<
    Pick<AssignmentRow, "id" | "assignment_name" | "class_name" | "status" | "due_date">
  >;
};

function readAnthropicText(response: Anthropic.Messages.Message) {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function extractDueDate(message: string) {
  const match = message.match(
    /\b(?:due|by|on)\s+((?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:\d{4}-\d{2}-\d{2}))/i
  );
  return match?.[1] || undefined;
}

function extractClassName(message: string) {
  const match = message.match(/\b(?:for|in)\s+([A-Z]{2,}\s?\d{1,3}[A-Z]?)/);
  return match?.[1] || undefined;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function normalizeNumericText(value: string) {
  return value.replace(/[,\s]+/g, "");
}

function extractMinSources(message: string) {
  const lower = message.toLowerCase();

  const rangeMatch = lower.match(/(\d+)\s*[-–]\s*(\d+)\s+(?:scholarly\s+|academic\s+|credible\s+)?sources?/);
  if (rangeMatch) {
    return Number(rangeMatch[1]);
  }

  const minimumMatch = lower.match(/(?:at least|minimum of|a minimum of)\s+(\d+)\s+(?:scholarly\s+|academic\s+|credible\s+)?sources?/);
  if (minimumMatch) {
    return Number(minimumMatch[1]);
  }

  const numericMatch = lower.match(/(\d+)\s+(?:scholarly\s+|academic\s+|credible\s+)?sources?/);
  if (numericMatch) {
    return Number(numericMatch[1]);
  }

  const wordMatch = lower.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:scholarly\s+|academic\s+|credible\s+)?sources?\b/
  );
  if (wordMatch) {
    return NUMBER_WORDS[wordMatch[1]];
  }

  if (/\bseveral\s+sources\b/.test(lower)) {
    return 3;
  }

  if (/\bcredible\s+sources?\b/.test(lower) || /\bscholarly\s+sources?\b/.test(lower)) {
    return 2;
  }

  return undefined;
}

function extractWordCount(message: string) {
  const rangeWordsMatch = message.match(/(\d[\d,]*)\s*[-–]\s*(\d[\d,]*)\s*words?/i);
  if (rangeWordsMatch) {
    return `${normalizeNumericText(rangeWordsMatch[1])}-${normalizeNumericText(rangeWordsMatch[2])} words`;
  }

  const singleWordsMatch = message.match(/(\d[\d,]*)\s*words?\b/i);
  if (singleWordsMatch) {
    return `${normalizeNumericText(singleWordsMatch[1])} words`;
  }

  const pageNumberMatch = message.match(/(\d+)\s*[-–]\s*(\d+)\s*pages?\b/i);
  if (pageNumberMatch) {
    return `${pageNumberMatch[1]}-${pageNumberMatch[2]} pages`;
  }

  const singlePageMatch = message.match(/(\d+)\s*pages?\b/i);
  if (singlePageMatch) {
    return `${singlePageMatch[1]} pages`;
  }

  const wordPageWordMatch = message.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+pages?\b/i
  );
  if (wordPageWordMatch) {
    return `${NUMBER_WORDS[wordPageWordMatch[1].toLowerCase()]} pages`;
  }

  return undefined;
}

function extractRequirements(message: string) {
  const citationMatch = message.match(/\b(MLA|APA|Chicago|IEEE)\b/i);
  const minSectionsMatch = message.match(/at least\s+(\d+)\s+sections?/i);
  const requiredSectionsMatch = message.match(
    /(?:include|required sections?|must have)\s*:\s*([^\n]+)/i
  );

  const requirements = {
    minSources: extractMinSources(message),
    citationFormat: citationMatch?.[1],
    pageCount: extractWordCount(message)?.includes("pages") ? extractWordCount(message) : undefined,
    wordCount: extractWordCount(message)?.includes("words") ? extractWordCount(message) : undefined,
    minSections: minSectionsMatch ? Number(minSectionsMatch[1]) : undefined,
    requiredSections: requiredSectionsMatch
      ? requiredSectionsMatch[1]
          .split(/,|;| and /i)
          .map((section) => section.trim())
          .filter(Boolean)
      : undefined,
  };

  return Object.values(requirements).some((value) =>
    Array.isArray(value) ? value.length > 0 : value !== undefined
  )
    ? requirements
    : undefined;
}

async function heuristicAcademicIntent(
  message: string,
  assignments: AssignmentIntentContext[]
): Promise<AcademicIntentResult> {
  const lower = message.toLowerCase();
  const travisIntent = await classifyTravisIntent({
    userMessage: message,
    conversationHistory: [],
    assignments,
  });

  const assignmentName =
    assignments.find((item) => lower.includes(item.assignment_name.toLowerCase()))
      ?.assignment_name || undefined;

  const baseData = {
    assignmentName,
    className: extractClassName(message),
    dueDate: extractDueDate(message),
    requirements: extractRequirements(message),
  };

  if (/(essay|paper|report|thesis|outline|draft|writing assignment)/.test(lower)) {
    return {
      studio: "paper",
      confidence: "high",
      extractedData: {
        ...baseData,
        topic: assignmentName || message,
        assignmentType: "paper",
      },
    };
  }

  if (/(math|equation|algebra|calculus|geometry|solve|problem set)/.test(lower)) {
    return {
      studio: "math",
      confidence: "high",
      extractedData: {
        ...baseData,
        topic: assignmentName || message,
        assignmentType: "problem_set",
      },
    };
  }

  if (/(quiz|study|flashcard|review|notes|exam|test|memorize)/.test(lower)) {
    return {
      studio: "study",
      confidence: "high",
      extractedData: {
        ...baseData,
        topic: assignmentName || message,
        assignmentType: "study",
      },
    };
  }

  if (/(code|coding|debug|program|programming|bug|review my code)/.test(lower)) {
    return {
      studio: "code_review",
      confidence: "high",
      extractedData: {
        ...baseData,
        topic: assignmentName || message,
        assignmentType: "coding",
      },
    };
  }

  if (
    travisIntent.primaryIntent === "build_week" ||
    travisIntent.primaryIntent === "rebalance" ||
    travisIntent.primaryIntent === "check_progress" ||
    travisIntent.primaryIntent === "check_risk" ||
    travisIntent.primaryIntent === "plan_assignment" ||
    /(deadline|assignment|schedule|plan|organize|what should i do)/.test(lower)
  ) {
    return {
      studio: "agenda",
      confidence: travisIntent.confidence,
      extractedData: baseData,
      clarifyingQuestion:
        travisIntent.confidence === "low"
          ? "Do you want help planning your work, studying, writing a paper, doing math, or reviewing code?"
          : undefined,
    };
  }

  return {
    studio: "unclear",
    confidence: "low",
    extractedData: baseData,
    clarifyingQuestion:
      "Are you working on a paper, math problem set, study session, schedule, or coding assignment?",
  };
}

export async function POST(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const message = String(body.message || "").trim();

  if (!message) {
    return NextResponse.json(
      { success: false, error: "message is required" },
      { status: 400 }
    );
  }

  const assignments: AssignmentIntentContext[] = Array.isArray(body.existingAssignments)
    ? body.existingAssignments.map((assignment) => ({
        id: assignment.id,
        assignment_name: assignment.assignment_name,
        class_name: assignment.class_name,
        status: assignment.status || null,
        due_date: assignment.due_date || null,
      }))
    : [];

  const fallback = await heuristicAcademicIntent(message, assignments);
  const apiKey = process.env.CLAUDE_API_KEY || null;

  if (!apiKey) {
    return NextResponse.json(fallback);
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      system: `Classify the student's message into one of these studios:
- paper: writing assignments, essays, research papers, reports
- math: math homework, problem sets, equations, calculations
- study: studying, quizzes, flashcards, reviewing material
- agenda: organizing assignments, deadlines, scheduling, planning
- code_review: programming assignments, coding projects, debugging

Also extract any assignment details mentioned:
topic, class name, assignment type, due date, assignment name.

Also extract any academic requirements mentioned:
- sourceCount: number of sources required
- citationFormat: citation style
- minSources should handle:
  "at least 3 sources", "3-5 sources", "3-5 scholarly sources",
  "a minimum of 4 sources", "three sources", "several sources", "credible sources"
- wordCount should handle:
  "1,000-1,500 word", "500 word", "1000 words"
- pageCount should handle:
  "two pages", "2 pages", "3-5 pages"
- minSections: minimum number of sections required
- requiredSections: any specific sections required

When requirements are listed as bullet points, numbered items, or
asterisks, extract each requirement the same way you would from
natural language. Specifically:
- Lines containing "source", "reference", "citation", "scholarly",
  "peer-reviewed" with a number -> extract as minSources and take the
  lower bound of any range
- Lines containing "word" or "page" with a number -> extract as
  wordCount or pageCount
- Lines containing "APA", "MLA", "Chicago", "citation style" ->
  extract as citationFormat
- Lines containing "thesis", "body paragraph", "conclusion" as
  structural requirements -> extract as requiredSections array

The source extraction must handle all these patterns:
- "Use at least 3-5 credible academic sources" -> minSources: 3
- "* Minimum 3 sources" -> minSources: 3
- "Include 4-6 peer-reviewed articles" -> minSources: 4
- "Sources: 3 required" -> minSources: 3

Add these under extractedData.requirements. If not mentioned, omit the field.

If the intent is unclear or could match multiple studios, set confidence to "low"
and provide a single clarifying question Travis should ask.

Return only valid JSON matching this schema:
{
  "studio": "paper" | "math" | "study" | "agenda" | "code_review" | "unclear",
  "confidence": "high" | "low",
  "extractedData": {
    "topic"?: string,
    "className"?: string,
    "assignmentType"?: string,
    "dueDate"?: string,
    "assignmentName"?: string,
    "requirements"?: {
      "minSources"?: number,
      "citationFormat"?: string,
      "pageCount"?: string,
      "wordCount"?: string,
      "minSections"?: number,
      "requiredSections"?: string[]
    }
  },
  "clarifyingQuestion"?: string
}`,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            message,
            existingAssignments: assignments,
          }),
        },
      ],
    });

    const parsed = JSON.parse(readAnthropicText(response)) as Partial<AcademicIntentResult>;
    const validStudio = new Set([
      "paper",
      "math",
      "study",
      "agenda",
      "code_review",
      "unclear",
    ]);

    const result: AcademicIntentResult = {
      studio:
        typeof parsed.studio === "string" && validStudio.has(parsed.studio)
          ? parsed.studio
          : fallback.studio,
      confidence: parsed.confidence === "high" ? "high" : "low",
      extractedData:
        parsed.extractedData && typeof parsed.extractedData === "object"
          ? {
              topic:
                typeof parsed.extractedData.topic === "string"
                  ? parsed.extractedData.topic
                  : fallback.extractedData.topic,
              className:
                typeof parsed.extractedData.className === "string"
                  ? parsed.extractedData.className
                  : fallback.extractedData.className,
              assignmentType:
                typeof parsed.extractedData.assignmentType === "string"
                  ? parsed.extractedData.assignmentType
                  : fallback.extractedData.assignmentType,
              dueDate:
                typeof parsed.extractedData.dueDate === "string"
                  ? parsed.extractedData.dueDate
                  : fallback.extractedData.dueDate,
              assignmentName:
                typeof parsed.extractedData.assignmentName === "string"
                  ? parsed.extractedData.assignmentName
                  : fallback.extractedData.assignmentName,
              requirements:
                parsed.extractedData.requirements &&
                typeof parsed.extractedData.requirements === "object"
                  ? {
                      minSources:
                        typeof parsed.extractedData.requirements.minSources === "number"
                          ? parsed.extractedData.requirements.minSources
                          : fallback.extractedData.requirements?.minSources,
                      citationFormat:
                        typeof parsed.extractedData.requirements.citationFormat === "string"
                          ? parsed.extractedData.requirements.citationFormat
                          : fallback.extractedData.requirements?.citationFormat,
                      pageCount:
                        typeof parsed.extractedData.requirements.pageCount === "string"
                          ? parsed.extractedData.requirements.pageCount
                          : fallback.extractedData.requirements?.pageCount,
                      wordCount:
                        typeof parsed.extractedData.requirements.wordCount === "string"
                          ? parsed.extractedData.requirements.wordCount
                          : fallback.extractedData.requirements?.wordCount,
                      minSections:
                        typeof parsed.extractedData.requirements.minSections === "number"
                          ? parsed.extractedData.requirements.minSections
                          : fallback.extractedData.requirements?.minSections,
                      requiredSections: Array.isArray(
                        parsed.extractedData.requirements.requiredSections
                      )
                        ? parsed.extractedData.requirements.requiredSections
                            .map((section) => String(section))
                            .filter(Boolean)
                        : fallback.extractedData.requirements?.requiredSections,
                    }
                  : fallback.extractedData.requirements,
            }
          : fallback.extractedData,
      clarifyingQuestion:
        typeof parsed.clarifyingQuestion === "string"
          ? parsed.clarifyingQuestion
          : fallback.clarifyingQuestion,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(fallback);
  }
}
