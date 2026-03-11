import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { chunkDocumentContext } from "@/lib/academic/victor/chunkDocumentContext";
import { buildStudyContext } from "@/lib/academic/victor/buildStudyContext";
import {
  buildMisconceptionInstruction,
  detectMisconception,
} from "@/lib/academic/victor/detectMisconception";
import {
  getCoachingProfileBlock,
  type CoachingProfile,
} from "@/lib/academic/victor/coachingProfiles";
import { VICTOR_INTEGRITY_BLOCK } from "@/lib/academic/victor/victorIntegrity";
import { STUDY_HUB_INTEGRITY_BLOCK } from "@/lib/academic/victor/studyHubIntegrity";
import { logConceptStruggle } from "@/lib/academic/victor/logConceptStruggle";

export const runtime = "nodejs";

type HistoryMessage = {
  role: "user" | "victor";
  content: string;
  misconceptionLevel?: "none" | "partial" | "fundamental" | null;
};

type QuizContext = {
  questionText: string;
  studentAnswer: string;
  correctAnswer: string;
  questionLabel: string;
};

function sanitizeProfile(input?: string | null): CoachingProfile {
  if (input === "critic" || input === "exam_prep" || input === "fast_review") {
    return input;
  }
  return "tutor";
}

function readAnthropicText(response: Anthropic.Messages.Message): string {
  if (!Array.isArray(response.content)) return "";
  const first = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  return first?.text || "";
}

const VICTOR_PERSONA_BLOCK = `
You are Victor, an academic coach. You teach for understanding through concise explanation and Socratic follow-up questions.

Use this behavior:
- Ground answers in the student's uploaded material first.
- Ask one follow-up question after explaining a concept.
- If the student asks for direct answers, push them to reasoning before confirming.
- If they ask for planning/scheduling, defer to Travis.
`.trim();

export async function POST(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "Missing CLAUDE_API_KEY." },
      { status: 500 }
    );
  }

  const body = (await request.json()) as {
    materialId?: string;
    message?: string;
    history?: HistoryMessage[];
    quizContext?: QuizContext | null;
  };

  const materialId = typeof body.materialId === "string" ? body.materialId : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
  const quizContext = body.quizContext || null;

  if (!materialId || !message) {
    return NextResponse.json(
      { success: false, error: "materialId and message are required." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: material, error: materialError } = await supabase
    .from("study_materials")
    .select("id, title, class_name, material_kind, content")
    .eq("id", materialId)
    .eq("user_id", userId)
    .single();

  if (materialError || !material) {
    return NextResponse.json(
      { success: false, error: "Study material not found." },
      { status: 404 }
    );
  }

  const { combined } = await chunkDocumentContext({
    documentContent: material.content || "",
    studentQuery: message,
  });

  const studyContext = buildStudyContext({
    materialName: material.title,
    className: material.class_name,
    materialType: material.material_kind,
    contentChunk: combined,
    studentQuery: message,
  });

  const misconceptionLevel = await detectMisconception(message);

  let coachingProfile: CoachingProfile = "tutor";
  if (material.class_name) {
    const { data: assignmentProfileRow } = await supabase
      .from("assignments")
      .select("id, victor_coaching_profile")
      .eq("user_id", userId)
      .eq("class_name", material.class_name)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    coachingProfile = sanitizeProfile(assignmentProfileRow?.victor_coaching_profile);
  }

  const coachingProfileBlock = getCoachingProfileBlock(coachingProfile);
  const misconceptionInstruction = buildMisconceptionInstruction(
    misconceptionLevel,
    coachingProfile
  );

  const { data: chamber } = await supabase
    .from("voice_chambers")
    .select("aggregate_fingerprint, confidence_level")
    .eq("user_id", userId)
    .eq("chamber", "academic")
    .maybeSingle();

  const voiceBlock =
    chamber && Number(chamber.confidence_level || 0) >= 30
      ? `VOICE CONTEXT:\n${chamber.aggregate_fingerprint || ""}`
      : "";

  const quizReasoningBlock = quizContext
    ? `
QUIZ CONNECTION CONTEXT:
- Question: ${quizContext.questionText}
- Student answer: ${quizContext.studentAnswer}
- Correct answer (for your internal reference): ${quizContext.correctAnswer}

Do not reveal the correct answer immediately. Ask the student to explain their reasoning first, then guide them to the correction.
`.trim()
    : "";

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 900,
    system: [
      VICTOR_PERSONA_BLOCK,
      studyContext,
      coachingProfileBlock,
      misconceptionInstruction ? `MISCONCEPTION INSTRUCTION:\n${misconceptionInstruction}` : "",
      VICTOR_INTEGRITY_BLOCK,
      STUDY_HUB_INTEGRITY_BLOCK,
      voiceBlock,
      quizReasoningBlock,
    ]
      .filter(Boolean)
      .join("\n\n"),
    messages: [
      ...history.map((item) => ({
        role: item.role === "victor" ? ("assistant" as const) : ("user" as const),
        content: item.content,
      })),
      { role: "user" as const, content: message },
    ],
  });

  const reply = readAnthropicText(response).trim() || "Let's walk through this together.";

  const previousMisconception = [...history]
    .reverse()
    .find((item) => item.role === "victor" && item.misconceptionLevel)?.misconceptionLevel;

  const shouldLogStruggle =
    (misconceptionLevel === "partial" || misconceptionLevel === "fundamental") &&
    (previousMisconception === "partial" || previousMisconception === "fundamental");

  if (shouldLogStruggle && material.class_name) {
    try {
      await logConceptStruggle(supabase, {
        userId,
        assignmentId: null,
        className: material.class_name,
        struggleType:
          misconceptionLevel === "fundamental" ? "misconception" : "incomplete_understanding",
        sessionNotes: `Study Hub material: ${material.title}`,
        studentMessages: history
          .filter((item) => item.role === "user")
          .map((item) => item.content)
          .concat(message)
          .slice(-2),
      });
    } catch {
      // non-blocking
    }
  }

  return NextResponse.json(
    {
      success: true,
      reply,
      misconceptionLevel,
      coachingProfile,
    },
    { status: 200 }
  );
}
