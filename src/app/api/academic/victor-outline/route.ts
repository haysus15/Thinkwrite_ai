import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import { getClaudeApiKey } from "@/lib/academic/victorContextBuilder";
import { VICTOR_INTEGRITY_BLOCK } from "@/lib/academic/victor/victorIntegrity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import type {
  AssignmentContext,
  IntakeConversationEntry,
  OutlineDraft,
  OutlineDraftSection,
  ParsedRequirements,
  StudentAcademicProfile,
} from "@/components/academic/outline/outlineTypes";
import {
  evaluateConclusionResponse,
  evaluateCounterargumentResponse,
  evaluateRequirementCoverage,
  evaluateSupportingPointsResponse,
  evaluateThesisResponse,
  type GoalHandlerResult,
  type FollowUpReason,
} from "@/lib/academic/victor/outlineGoalHandlers";
import { FOLLOW_UP_MESSAGES } from "@/lib/academic/victor/outlineFollowUps";
import {
  buildProfileGuidance,
  buildStudentAcademicProfile,
} from "@/lib/academic/victor/studentProfile";
import { stripNumberPrefix } from "@/lib/academic/outlineText";

export const runtime = "nodejs";

interface VictorOutlineRequest {
  mode?: "quick_structure" | "section_development" | "final_assessment";
  conversationHistory: IntakeConversationEntry[];
  conversationSummary?: string;
  currentDraft: OutlineDraft;
  draft?: OutlineDraft;
  currentGoal: 1 | 2 | 3 | 4 | 5;
  assignmentRequirements: ParsedRequirements | null;
  studentMessage: string;
  platform?: "mobile" | "desktop";
  isDueSoon?: boolean;
  className?: string;
  assignmentType?: string;
  assignmentContext?: AssignmentContext | null;
  sectionIndex?: number;
  sections?: OutlineDraftSection[];
  thesis?: string | null;
  studentResponse?: string | null;
}

interface VictorOutlineResponse {
  victorMessage: string;
  updatedDraft: OutlineDraft;
  nextGoal: 1 | 2 | 3 | 4 | 5;
  goalComplete: boolean;
  allGoalsComplete: boolean;
}

type MessageLlmResponse = { message: string };
type ParsedSupportingPoint = {
  title: string;
  keyPoints: string[];
};

const VICTOR_OUTLINE_TIMEOUT_MS = 15000;
function buildScopeGuidance(wordCount: string) {
  const lower = wordCount.toLowerCase();
  if (lower.includes("500") || lower.includes("1 page") || lower.includes("one page")) {
    return "This is a short paper. Guide the student toward 2-3 focused sections maximum. Tell them explicitly that fewer, stronger sections work better than many thin ones.";
  }
  if (
    lower.includes("5000") ||
    lower.includes("10 page") ||
    lower.includes("15 page") ||
    lower.includes("20 page")
  ) {
    return "This is a longer paper. Guide the student toward 4-5 substantial sections. Each section should be able to stand as a mini-argument on its own.";
  }
  return "";
}

function buildVictorContext(assignmentContext: AssignmentContext | null | undefined) {
  if (!assignmentContext) return "";

  const parts: string[] = [];
  const descriptor = [
    assignmentContext.assignment_type ?? "paper",
    assignmentContext.assignment_name ? `"${assignmentContext.assignment_name}"` : null,
    assignmentContext.class_name ? `for ${assignmentContext.class_name}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  if (descriptor) {
    parts.push(`The student is working on a ${descriptor}.`);
  }

  if (assignmentContext.due_date) {
    const days = Math.ceil(
      (new Date(assignmentContext.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (days <= 7) {
      parts.push(`Due in ${days} day${days === 1 ? "" : "s"}.`);
    }
  }

  if (assignmentContext.requirements?.wordCount) {
    parts.push(`Required length: approximately ${assignmentContext.requirements.wordCount}.`);
  }
  if (assignmentContext.requirements?.minSections) {
    parts.push(`Minimum sections required: ${assignmentContext.requirements.minSections}.`);
  }
  if (assignmentContext.requirements?.citationFormat) {
    parts.push(`Citation format: ${assignmentContext.requirements.citationFormat}.`);
  }

  return parts.join(" ");
}

function getOpeningMessage(
  isDueSoon: boolean,
  assignmentContext?: AssignmentContext | null
) {
  const assignmentLead = assignmentContext?.assignment_name
    ? `Travis tells me you're working on "${assignmentContext.assignment_name}"${
        assignmentContext.class_name ? ` for ${assignmentContext.class_name}` : ""
      }.\n\n`
    : "";

  const scopeGuidance = assignmentContext?.requirements?.wordCount
    ? ` ${buildScopeGuidance(assignmentContext.requirements.wordCount)}`
    : "";

  if (isDueSoon) {
    return (
      assignmentLead +
      "Before we start building your outline, I want to understand what you are actually trying to say.\n\n" +
      "Your paper is due soon, so we can either go through the full outline conversation or switch to a quick structure if you want a faster starting point.\n\n" +
      "What is your central argument for this paper? Don't worry about phrasing it perfectly — just tell me what you believe and why it matters." +
      scopeGuidance
    );
  }

  return (
    assignmentLead +
    "Before we start building your outline, I want to understand what you are actually trying to say.\n\nWhat is your central argument for this paper? Don't worry about phrasing it perfectly — just tell me what you believe and why it matters." +
    scopeGuidance
  );
}

function createEmptyDraft(): OutlineDraft {
  return {
    thesis: null,
    sections: [],
    conclusion: null,
    sourceContext: [],
    sourcesAcknowledged: false,
    requirementGaps: [],
    confidence: "building",
  };
}

function buildQuickStructureDraft(context: VictorOutlineRequest["assignmentContext"]): OutlineDraft {
  const topic = context?.assignment_name?.trim() || "Working thesis";
  const requirements = context?.requirements || null;
  const requiredSections = requirements?.requiredSections?.filter(Boolean) || [];
  const requiredTopics = requirements?.requiredTopics?.filter(Boolean) || [];

  const starterTitles = [
    ...requiredSections,
    ...requiredTopics.slice(0, 2),
    "Main analysis",
    "Conclusion",
  ].filter(Boolean);

  const uniqueTitles = Array.from(new Set(starterTitles)).slice(0, 4);
  const sectionTitles =
    uniqueTitles.length >= 2
      ? uniqueTitles
      : ["Introduction", "Main analysis", "Evidence", "Conclusion"];

  return {
    thesis: topic,
    sections: sectionTitles
      .filter((title) => title !== "Conclusion")
      .map((title) => ({
        id: uuidv4(),
        title,
        keyPoints: [],
        fromGoal: 2,
        victorChecked: false,
      })),
    conclusion: "",
    sourceContext: [],
    sourcesAcknowledged: Boolean(requirements?.minSources),
    requirementGaps: [],
    confidence: "draft",
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Victor outline request timed out.")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

function parseJson<T>(text: string): T | null {
  try {
    const trimmed = text.trim();
    const stripped = trimmed.startsWith("```")
      ? trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()
      : trimmed;
    return JSON.parse(stripped) as T;
  } catch {
    return null;
  }
}

function normalizeSentence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function cleanKeyPoint(text: string) {
  return text
    .replace(/^\*+\s*/, "")
    .replace(/^-\s*/, "")
    .replace(/^•\s*/, "")
    .trim();
}

function parsePointIntoTitleAndKeyPoints(text: string): ParsedSupportingPoint {
  const cleaned = stripNumberPrefix(text.trim());
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 5);

  if (sentences.length === 0) {
    return { title: cleaned, keyPoints: [] };
  }

  if (sentences.length === 1) {
    if (cleaned.length <= 80) {
      return { title: cleaned, keyPoints: [] };
    }

    const commaIndex = cleaned.indexOf(",", 40);
    if (commaIndex > 0 && commaIndex < 100) {
      return {
        title: cleaned.slice(0, commaIndex).trim(),
        keyPoints: [cleaned.slice(commaIndex + 1).trim()].filter(
          (segment) => segment.length > 5
        ),
      };
    }

    return { title: cleaned.slice(0, 80).trim(), keyPoints: [] };
  }

  return {
    title: sentences[0],
    keyPoints: sentences
      .slice(1)
      .map((sentence) => cleanKeyPoint(stripNumberPrefix(sentence))),
  };
}

function splitSupportingPoints(extractedValue: string): ParsedSupportingPoint[] {
  const numberedBoundary = /(?:^|\n)\s*\d+[\.\)]\s+/;
  const rawSegments = extractedValue
    .split(numberedBoundary)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 10);

  if (rawSegments.length >= 2) {
    return rawSegments.map((segment) => parsePointIntoTitleAndKeyPoints(segment));
  }

  const paragraphSegments = extractedValue
    .split(/\n\n+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 10);

  if (paragraphSegments.length >= 2) {
    return paragraphSegments.map((segment) => parsePointIntoTitleAndKeyPoints(segment));
  }

  return [parsePointIntoTitleAndKeyPoints(extractedValue)];
}

function extractKeyPointsFromResponse(response: string): string[] {
  return response
    .split(/(?<=[.!?])\s+|\n+|\d+[\.\)]\s+/)
    .map((segment) => cleanKeyPoint(stripNumberPrefix(segment.trim())))
    .filter((segment) => segment.length > 8)
    .slice(0, 3);
}

function buildSectionDevelopmentQuestion(
  section: OutlineDraftSection,
  thesis: string | null
) {
  const meaningfulPoints = section.keyPoints.filter((point) => point.trim().length > 5);
  const hasPoints = meaningfulPoints.length > 0;
  const thesisSnippet = thesis
    ? `${thesis.slice(0, 70)}${thesis.length > 70 ? "..." : ""}`
    : null;

  if (hasPoints) {
    const firstPoint = meaningfulPoints[0].slice(0, 80);
    if (thesisSnippet) {
      return `For your "${section.title}" section — you mentioned ${firstPoint}. What makes that decisive rather than just relevant to your argument that ${thesisSnippet}? Push past the what and tell me the why.`;
    }

    return `For your "${section.title}" section — you mentioned ${firstPoint}. Why is that significant? What does it prove that your reader would not otherwise accept?`;
  }

  if (thesisSnippet) {
    return `For your "${section.title}" section — what specific evidence or reasoning shows this supports your argument that ${thesisSnippet}? Give me the key details you want to include.`;
  }

  return `For your "${section.title}" section — what specific evidence or reasoning supports this point? Give me the key details.`;
}

function buildSectionDevelopmentAffirmation(
  section: OutlineDraftSection
) {
  return `Good. I've added those points to your "${section.title}" section.`;
}

function extractSourceMentions(response: string): string[] {
  return response
    .split(/[,;]|\band\b/i)
    .map((segment) => cleanKeyPoint(stripNumberPrefix(segment.trim())))
    .filter((segment) => segment.length > 5);
}

function addSourceContextToDraft(
  draft: OutlineDraft,
  sourceMentions: string[]
): OutlineDraft {
  return {
    ...draft,
    sourceContext: Array.from(new Set([...(draft.sourceContext ?? []), ...sourceMentions])),
    sourcesAcknowledged: true,
  };
}

function generateSearchQueries(
  sections: OutlineDraftSection[],
  thesis: string | null
): string {
  const sectionQueries = sections
    .filter((section) => section.fromGoal === 2)
    .slice(0, 3)
    .map((section) => {
      const scholarUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(section.title)}`;
      return `• ${section.title}
  Search: ${scholarUrl}`;
    })
    .join("\n");

  const thesisLine = thesis ? `\nYour thesis: ${thesis}\n` : "\n";
  return `Here are search starting points for your sections:${thesisLine}
${sectionQueries}

Search Google Scholar for peer-reviewed sources. Come back when you have titles and I'll note them for your paper.`;
}

function isSourceHelpRequest(response: string) {
  return /don't have sources|do not have sources|help me find|can you help|search terms|find some/i.test(
    response
  );
}

function isSourceSkipResponse(response: string) {
  return /add sources later|don't need help|do not need help|skip|later/i.test(response);
}

function studentProvidedSourceInfo(response: string) {
  const lower = response.toLowerCase();
  if (response.includes("http") || response.includes("www.")) return true;
  if (/\(\d{4}\)/.test(response)) return true;
  if (
    lower.includes("book") ||
    lower.includes("journal") ||
    lower.includes("article") ||
    lower.includes("study") ||
    lower.includes("research") ||
    lower.includes("source")
  ) {
    return true;
  }
  if (response.split(/\s+/).filter(Boolean).length > 8) return true;
  return false;
}

function buildGoal4SourcePrompt(requirements: ParsedRequirements | null) {
  const minSources =
    requirements?.minSources ??
    (requirements as { min_sources?: number } | null)?.min_sources ??
    0;
  const citationFormat =
    requirements?.citationFormat ??
    (requirements as { citation_style?: string } | null)?.citation_style ??
    null;
  const sourceNote = citationFormat
    ? `One more thing before we finish — your assignment requires ${minSources} academic sources in ${citationFormat} format.`
    : `One more thing before we finish — your assignment requires at least ${minSources} academic sources.`;

  return `${sourceNote} Do you have any sources in mind, or would you like search suggestions for each section?`;
}

function buildConclusionTransition(prefix: string) {
  return `${prefix}\n\nLast thing: how does your conclusion connect back to your opening argument? What should the reader walk away believing that they did not believe before reading?`;
}

function buildFinalAssessmentPrompt(
  draft: OutlineDraft,
  assignmentContext: AssignmentContext | null,
  thesis: string | null
) {
  const sectionSummary = draft.sections
    .map((section) => `- ${section.title}: ${section.keyPoints.length} key points`)
    .join("\n");
  const requirements = assignmentContext?.requirements;
  const minSources =
    requirements?.minSources ??
    (requirements as { min_sources?: number } | null)?.min_sources ??
    null;
  const citationFormat =
    requirements?.citationFormat ??
    (requirements as { citation_style?: string } | null)?.citation_style ??
    null;
  const wordCount =
    requirements?.wordCount ??
    (requirements as { word_count?: string | number } | null)?.word_count ??
    null;
  const minSections =
    requirements?.minSections ??
    (requirements as { min_sections?: number } | null)?.min_sections ??
    null;

  const requirementNotes = [
    typeof minSources === "number"
      ? `Requires ${minSources} sources in ${citationFormat ?? "academic"} format`
      : null,
    wordCount ? `Target length: ${wordCount}` : null,
    typeof minSections === "number" ? `Minimum sections: ${minSections}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  return `You are Victor, a Socratic academic coach. A student has just finished building their outline.

THESIS: ${thesis ?? "Not yet defined"}

SECTIONS BUILT:
${sectionSummary}

COUNTERARGUMENT: ${draft.sections.find((section) => section.fromGoal === 3)?.keyPoints[0] ?? "Not provided"}

CONCLUSION DIRECTION: ${draft.conclusion ?? "Not provided"}

ASSIGNMENT REQUIREMENTS: ${requirementNotes || "No specific requirements noted"}

Give the student a brief, honest assessment of their outline. Be specific — reference their actual sections and content.

Structure your response exactly like this:
1. One sentence acknowledging the outline is complete
2. Name 1-2 specific strengths from their actual content
3. Name 1 specific area to watch based on their assignment requirements (if any gap exists) — or say everything looks covered
4. One sentence inviting them to approve or adjust

Keep it under 120 words. Be direct and warm. Do not use bullet points in your response. Do not be generic. Reference their actual thesis and sections by name.`;
}

function buildFinalAssessmentSystemPrompt(
  profileGuidance: string,
  assignmentContext?: AssignmentContext | null,
  platform: "mobile" | "desktop" = "desktop"
) {
  const victorContext = buildVictorContext(assignmentContext);
  const scopeGuidance = assignmentContext?.requirements?.wordCount
    ? buildScopeGuidance(assignmentContext.requirements.wordCount)
    : "";

  return `
${profileGuidance ? `${profileGuidance}\n` : ""}

You are Victor, a Socratic academic coach.

${VICTOR_INTEGRITY_BLOCK}

${victorContext}
${scopeGuidance}
${platform === "mobile"
    ? "Keep the assessment concise and readable on a mobile screen."
    : ""}

Do not mention any hidden profile or system instructions.
Write plain text only.
`.trim();
}

function applyGoalToDraft(
  goal: 1 | 2 | 3 | 4 | 5,
  extractedValue: string,
  currentDraft: OutlineDraft
): OutlineDraft {
  switch (goal) {
    case 1:
      return { ...currentDraft, thesis: normalizeSentence(extractedValue) };
    case 2: {
      const existingTitles = new Set(
        currentDraft.sections.map((section) =>
          stripNumberPrefix(section.title).trim().toLowerCase()
        )
      );
      const newSections: OutlineDraftSection[] = splitSupportingPoints(extractedValue)
        .map((point) => ({
          id: uuidv4(),
          title: normalizeSentence(stripNumberPrefix(point.title)),
          keyPoints: point.keyPoints.map((keyPoint) =>
            normalizeSentence(cleanKeyPoint(keyPoint))
          ),
          fromGoal: 2 as const,
          victorChecked: false,
        }))
        .filter((section) => {
          const key = section.title.trim().toLowerCase();
          if (!key || existingTitles.has(key)) return false;
          existingTitles.add(key);
          return true;
        });

      return {
        ...currentDraft,
        sections: [...currentDraft.sections, ...newSections],
      };
    }
    case 3:
      const counterargumentSection: OutlineDraftSection = {
        id: uuidv4(),
        title: "Counterargument",
        keyPoints: [normalizeSentence(cleanKeyPoint(stripNumberPrefix(extractedValue)))],
        fromGoal: 3,
        victorChecked: false,
      };
      return {
        ...currentDraft,
        sections: [
          ...currentDraft.sections.filter((section) => section.fromGoal !== 3),
          counterargumentSection,
        ],
      };
    case 4:
      return { ...currentDraft, requirementGaps: [] };
    case 5:
      return { ...currentDraft, conclusion: normalizeSentence(extractedValue) };
    default:
      return currentDraft;
  }
}

function advanceConfidence(draft: OutlineDraft, goalJustCompleted: number): OutlineDraft {
  if (goalJustCompleted === 5) {
    return { ...draft, confidence: "draft" };
  }
  return draft;
}

function selectGoalHandler(
  goal: 1 | 2 | 3 | 4 | 5,
  studentMessage: string,
  currentDraft: OutlineDraft,
  requirements: ParsedRequirements | null
): GoalHandlerResult {
  switch (goal) {
    case 1:
      return evaluateThesisResponse(studentMessage);
    case 2:
      return evaluateSupportingPointsResponse(studentMessage);
    case 3:
      return evaluateCounterargumentResponse(studentMessage);
    case 4:
      return evaluateRequirementCoverage(currentDraft, requirements);
    case 5:
    default:
      return evaluateConclusionResponse(studentMessage);
  }
}

function followUpMessageFor(
  reason: FollowUpReason,
  input: VictorOutlineRequest,
  handlerResult: GoalHandlerResult
) {
  const topic =
    input.currentDraft.thesis ||
    input.className ||
    input.assignmentType ||
    "this topic";
  const thesis = input.currentDraft.thesis || topic;
  const gap = handlerResult.extractedValue || "an unmet requirement";

  switch (reason) {
    case "topic_not_argument":
      return FOLLOW_UP_MESSAGES.topic_not_argument(input.studentMessage, topic);
    case "too_short":
      return FOLLOW_UP_MESSAGES.too_short();
    case "too_vague":
      return FOLLOW_UP_MESSAGES.too_vague(topic);
    case "no_counterargument":
      return FOLLOW_UP_MESSAGES.no_counterargument(thesis);
    case "missing_requirement":
      return FOLLOW_UP_MESSAGES.missing_requirement(gap);
    default:
      return FOLLOW_UP_MESSAGES.too_short();
  }
}

function satisfiedBaseMessage(
  goal: 1 | 2 | 3 | 4 | 5,
  updatedDraft: OutlineDraft,
  requirements: ParsedRequirements | null
) {
  if (goal === 5) {
    return "Here is what we built. Take a look at the panel on the right — that is your outline. Does this reflect your argument the way you intended it?";
  }

  if (goal === 1) {
    return "Good. Now what are the two or three strongest points that support that argument? These will become your main sections.";
  }

  if (goal === 2) {
    return "Good. What is the strongest objection someone could make to your argument? You do not have to solve it yet — just identify it.";
  }

  if (goal === 3) {
    if (!requirements) {
      return "Last thing: how does your conclusion connect back to your opening argument? What should the reader walk away believing that they did not believe before reading?";
    }
    return "Now let's check your assignment requirements against the structure you have so far.";
  }

  return "Last thing: how does your conclusion connect back to your opening argument? What should the reader walk away believing that they did not believe before reading?";
}

async function insertTelemetryEvent(params: {
  userId: string | null;
  eventType: string;
  severity: "info" | "warn" | "error";
  payload: Record<string, unknown>;
}) {
  if (!params.userId) return;
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.from("telemetry_events").insert({
      user_id: params.userId,
      event_type: params.eventType,
      workspace: "academic",
      severity: params.severity,
      payload: params.payload,
    });
  } catch {
    // Telemetry must never block caller behavior.
  }
}

function buildMessageSystemPrompt(
  profileGuidance: string,
  conversationSummary?: string,
  assignmentContext?: AssignmentContext | null,
  platform: "mobile" | "desktop" = "desktop"
) {
  const victorContext = buildVictorContext(assignmentContext);
  const scopeGuidance = assignmentContext?.requirements?.wordCount
    ? buildScopeGuidance(assignmentContext.requirements.wordCount)
    : "";

  return `
${profileGuidance ? `${profileGuidance}\n` : ""}

You are Victor, a Socratic academic coach.

${VICTOR_INTEGRITY_BLOCK}

${victorContext}
${scopeGuidance}
${platform === "mobile"
    ? "Keep your responses concise — the student is on a mobile screen.\nLimit each message to 3-4 sentences maximum.\nUse shorter sentences than you would on desktop.\n"
    : ""}
${conversationSummary ? `Conversation summary so far:\n${conversationSummary}\n` : ""}

Return valid JSON only:
{
  "message": string
}

Rules:
- Keep the message concise and natural.
- Stay focused on the specific goal transition or follow-up.
- Do not provide essay content the student can submit.
- Do not override the provided base message intent.
`.trim();
}

function buildMessageUserPrompt(input: {
  mode: "affirm" | "follow_up";
  goal: 1 | 2 | 3 | 4 | 5;
  className?: string;
  assignmentType?: string;
  thesis?: string | null;
  baseMessage: string;
}) {
  return JSON.stringify(input, null, 2);
}

async function generateVictorMessage(params: {
  apiKey: string | null;
  baseMessage: string;
  mode: "affirm" | "follow_up";
  goal: 1 | 2 | 3 | 4 | 5;
  className?: string;
  assignmentType?: string;
  thesis?: string | null;
  conversationSummary?: string;
  assignmentContext?: AssignmentContext | null;
  platform?: "mobile" | "desktop";
  userId: string | null;
  profileGuidance: string;
}): Promise<string> {
  if (!params.apiKey) return params.baseMessage;

  let rawResponse = "";

  try {
    const anthropic = new Anthropic({ apiKey: params.apiKey });
    const response = await withTimeout(
      anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 220,
        system: buildMessageSystemPrompt(
          params.profileGuidance,
          params.conversationSummary,
          params.assignmentContext,
          params.platform ?? "desktop"
        ),
        messages: [
          {
            role: "user",
            content: buildMessageUserPrompt({
              mode: params.mode,
              goal: params.goal,
              className: params.className,
              assignmentType: params.assignmentType,
              thesis: params.thesis,
              baseMessage: params.baseMessage,
            }),
          },
        ],
      }),
      VICTOR_OUTLINE_TIMEOUT_MS
    );

    rawResponse =
      response.content.find(
        (block): block is Anthropic.TextBlock => block.type === "text"
      )?.text || "";

    const parsed = parseJson<MessageLlmResponse>(rawResponse);
    if (!parsed?.message?.trim()) {
      await insertTelemetryEvent({
        userId: params.userId,
        eventType: "victor_outline_parse_failure",
        severity: "error",
        payload: {
          goal: params.goal,
          errorType: "json_parse",
          rawResponseLength: rawResponse.length,
        },
      });
      return params.baseMessage;
    }

    return parsed.message.trim();
  } catch {
    await insertTelemetryEvent({
      userId: params.userId,
      eventType: "victor_outline_parse_failure",
      severity: "error",
      payload: {
        goal: params.goal,
        errorType: "model_error",
        rawResponseLength: rawResponse.length,
      },
    });
    return params.baseMessage;
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as VictorOutlineRequest | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { userId } = await getAuthUser();
  const apiKey = getClaudeApiKey();
  const currentDraft = body.currentDraft ?? createEmptyDraft();
  const studentMessage = body.studentMessage.trim();
  const supabase = await createSupabaseServerClient();
  const profile = userId
    ? await buildStudentAcademicProfile(userId, supabase)
    : null;
  const { data: prefs } = userId
    ? await supabase
        .from("user_preferences")
        .select("academic_settings")
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null };
  const rawAcademicSettings =
    prefs?.academic_settings && typeof prefs.academic_settings === "object"
      ? (prefs.academic_settings as Record<string, unknown>)
      : {};
  const rawOverrides =
    rawAcademicSettings.profileOverrides &&
    typeof rawAcademicSettings.profileOverrides === "object"
      ? (rawAcademicSettings.profileOverrides as StudentAcademicProfile["overridePatterns"])
      : {};
  const profileWithOverrides: StudentAcademicProfile | null = profile
    ? {
        ...profile,
        overridePatterns: rawOverrides,
        thesisStrength: rawOverrides.thesisStrength ?? profile.thesisStrength,
        counterargumentStrength:
          rawOverrides.counterargumentStrength ?? profile.counterargumentStrength,
        conclusionStrength:
          rawOverrides.conclusionStrength ?? profile.conclusionStrength,
      }
    : null;
  const profileGuidance = profileWithOverrides
    ? buildProfileGuidance(profileWithOverrides)
    : "";

  if (body.mode === "quick_structure") {
    const starterDraft = buildQuickStructureDraft(body.assignmentContext);
    return NextResponse.json({
      victorMessage:
        "Here is a starting structure based on your assignment. This is a framework — not a finished outline. Read through it and tell me what you want to change, or edit the sections directly in the panel on the right.",
      updatedDraft: starterDraft,
      nextGoal: 5,
      goalComplete: true,
      allGoalsComplete: true,
    } satisfies VictorOutlineResponse);
  }

  if (body.mode === "section_development") {
    const sectionIndex = typeof body.sectionIndex === "number" ? body.sectionIndex : -1;
    const sections = body.sections ?? currentDraft.sections;
    const section = sectionIndex >= 0 ? sections[sectionIndex] : null;

    if (!section) {
      return NextResponse.json({ error: "Section not found." }, { status: 400 });
    }

    const studentResponse = body.studentResponse?.trim();
    if (!studentResponse) {
      return NextResponse.json({
        victorMessage: buildSectionDevelopmentQuestion(section, body.thesis ?? currentDraft.thesis),
        sectionIndex,
        developmentComplete: false,
      });
    }

    const updatedKeyPoints = extractKeyPointsFromResponse(studentResponse);
    return NextResponse.json({
      victorMessage: buildSectionDevelopmentAffirmation(section),
      updatedKeyPoints,
      sectionIndex,
      developmentComplete: true,
    });
  }

  if (body.mode === "final_assessment") {
    const draft = body.draft ?? currentDraft;
    if (!draft) {
      return NextResponse.json(
        { victorMessage: "Your outline looks solid. Take a look at the panel and approve when ready." },
        { status: 200 }
      );
    }

    if (!apiKey) {
      return NextResponse.json({
        victorMessage:
          "Your outline looks solid. Take a look at the panel and approve when ready.",
      });
    }

    try {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        system: buildFinalAssessmentSystemPrompt(
          profileGuidance,
          body.assignmentContext,
          body.platform ?? "desktop"
        ),
        messages: [
          {
            role: "user",
            content: buildFinalAssessmentPrompt(
              draft,
              body.assignmentContext ?? null,
              body.thesis ?? draft.thesis
            ),
          },
        ],
      });

      const message =
        response.content.find(
          (block): block is Anthropic.TextBlock => block.type === "text"
        )?.text?.trim() ||
        "Your outline looks solid. Take a look at the panel and approve when ready.";

      return NextResponse.json({ victorMessage: message });
    } catch {
      return NextResponse.json({
        victorMessage:
          "Your outline looks solid. Take a look at the panel and approve when ready.",
      });
    }
  }

  if (!studentMessage && body.currentGoal === 1 && body.conversationHistory.length === 0) {
    return NextResponse.json({
      victorMessage: getOpeningMessage(
        Boolean(body.isDueSoon),
        body.assignmentContext
      ),
      updatedDraft: currentDraft,
      nextGoal: 1,
      goalComplete: false,
      allGoalsComplete: false,
    });
  }

  const activeRequirements = body.assignmentContext?.requirements ?? body.assignmentRequirements;
  const minSourcesRequired =
    body.assignmentRequirements?.minSources ??
    (body.assignmentRequirements as { min_sources?: number } | null)?.min_sources ??
    body.assignmentContext?.requirements?.minSources ??
    (body.assignmentContext?.requirements as { min_sources?: number } | null)?.min_sources ??
    0;
  if (
    body.currentGoal === 4 &&
    minSourcesRequired > 0 &&
    (currentDraft.requirementGaps?.length ?? 0) === 0
  ) {
    let updatedDraft = currentDraft;
    let victorMessage = "";
    const citationFormat =
      activeRequirements?.citationFormat ??
      (activeRequirements as { citation_style?: string } | null)?.citation_style ??
      null;
    const sourceRequirementLine = citationFormat
      ? `Your assignment requires ${minSourcesRequired} sources total in ${citationFormat} format.`
      : `Your assignment requires ${minSourcesRequired} sources total.`;

    if (isSourceHelpRequest(studentMessage)) {
      updatedDraft = addSourceContextToDraft(currentDraft, [
        "Student asked Victor for source search help during Goal 4.",
      ]);
      victorMessage = buildConclusionTransition(
        generateSearchQueries(currentDraft.sections, currentDraft.thesis)
      );
    } else if (isSourceSkipResponse(studentMessage)) {
      updatedDraft = addSourceContextToDraft(currentDraft, [
        "Student plans to add citations manually later.",
      ]);
      victorMessage = buildConclusionTransition(
        "No problem. You can add citations when you're writing. Let's continue."
      );
    } else {
      const sourceMentions = extractSourceMentions(studentMessage);
      updatedDraft =
        sourceMentions.length > 0 || studentProvidedSourceInfo(studentMessage)
          ? addSourceContextToDraft(
              currentDraft,
              sourceMentions.length > 0 ? sourceMentions : [studentMessage.trim()]
            )
          : {
              ...currentDraft,
              sourcesAcknowledged: true,
            };
      victorMessage = buildConclusionTransition(
        sourceMentions.length > 0 || studentProvidedSourceInfo(studentMessage)
          ? `Good — I've noted that source for your paper. ${sourceRequirementLine} You can add more as you research. Let's finish the outline.`
          : "No problem. You can add citations when you're writing. Let's continue."
      );
    }

    await insertTelemetryEvent({
      userId,
      eventType: "victor_outline_turn",
      severity: "info",
      payload: {
        goal: 4,
        goalSatisfied: true,
        followUpReason: null,
        studentWordCount: studentMessage.split(/\s+/).filter(Boolean).length,
        goalAdvanced: true,
        draftSectionCount: updatedDraft.sections.length,
        draftConfidence: updatedDraft.confidence,
      },
    });

    return NextResponse.json({
      victorMessage,
      updatedDraft,
      nextGoal: 5,
      goalComplete: true,
      allGoalsComplete: false,
    } satisfies VictorOutlineResponse);
  }

  const handlerResult = selectGoalHandler(
    body.currentGoal,
    studentMessage,
    currentDraft,
    body.assignmentRequirements
  );

  let updatedDraft = currentDraft;
  let nextGoal: 1 | 2 | 3 | 4 | 5 = body.currentGoal;
  let goalComplete = false;
  let allGoalsComplete = false;
  let baseMessage = "";
  let mode: "affirm" | "follow_up" = "follow_up";

  if (handlerResult.goalSatisfied) {
    goalComplete = true;
    const extractedValue = handlerResult.extractedValue ?? studentMessage;
    updatedDraft = advanceConfidence(
      applyGoalToDraft(body.currentGoal, extractedValue, currentDraft),
      body.currentGoal
    );

    if (body.currentGoal === 5) {
      nextGoal = 5;
      allGoalsComplete = true;
      baseMessage = satisfiedBaseMessage(body.currentGoal, updatedDraft, body.assignmentRequirements);
    } else if (body.currentGoal === 3) {
      const requirementResult = evaluateRequirementCoverage(updatedDraft, body.assignmentRequirements);
      if (requirementResult.goalSatisfied) {
        if (minSourcesRequired > 0) {
          nextGoal = 4;
          goalComplete = false;
          baseMessage = buildGoal4SourcePrompt(activeRequirements);
          mode = "follow_up";
        } else {
          nextGoal = 5;
          baseMessage = satisfiedBaseMessage(4, updatedDraft, body.assignmentRequirements);
        }
      } else {
        nextGoal = 4;
        goalComplete = false;
        baseMessage = followUpMessageFor(
          requirementResult.followUpReason ?? "missing_requirement",
          body,
          requirementResult
        );
        updatedDraft = {
          ...updatedDraft,
          requirementGaps: requirementResult.extractedValue ? [requirementResult.extractedValue] : [],
        };
      }
    } else {
      nextGoal = (body.currentGoal + 1) as 2 | 3 | 4 | 5;
      baseMessage = satisfiedBaseMessage(body.currentGoal, updatedDraft, body.assignmentRequirements);
    }

    mode = "affirm";
  } else {
    updatedDraft = currentDraft;
    nextGoal = body.currentGoal;
    baseMessage = followUpMessageFor(
      handlerResult.followUpReason ?? "too_short",
      body,
      handlerResult
    );
    mode = "follow_up";
  }

  const victorMessage = await generateVictorMessage({
    apiKey,
    baseMessage,
    mode,
    goal: body.currentGoal,
    className: body.className,
    assignmentType: body.assignmentType,
    thesis: updatedDraft.thesis,
    conversationSummary: body.conversationSummary,
    assignmentContext: body.assignmentContext,
    platform: body.platform ?? "desktop",
    userId,
    profileGuidance,
  });

  await insertTelemetryEvent({
    userId,
    eventType: "victor_outline_turn",
    severity: "info",
    payload: {
      goal: body.currentGoal,
      goalSatisfied: handlerResult.goalSatisfied,
      followUpReason: handlerResult.followUpReason ?? null,
      studentWordCount: studentMessage.split(/\s+/).filter(Boolean).length,
      goalAdvanced: handlerResult.goalSatisfied,
      draftSectionCount: updatedDraft.sections.length,
      draftConfidence: updatedDraft.confidence,
    },
  });

  return NextResponse.json({
    victorMessage,
    updatedDraft,
    nextGoal,
    goalComplete,
    allGoalsComplete,
  } satisfies VictorOutlineResponse);
}
