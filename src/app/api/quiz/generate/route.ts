// src/app/api/quiz/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { QuizQuestion, QuizQuestionType } from "@/types/academic-studio";
import { validateQuizOutput } from "@/lib/academic/contentQualityGuard";
import { logEvent } from "@/lib/telemetry/logEvent";
import { DEFAULT_QUIZ_DEFAULTS, parseMaterialMetadata } from "@/components/academic/study-hub/metadata";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function normalizeQuestions(questions: any[]): QuizQuestion[] {
  return questions.map((question, index) => ({
    id: question.id || `q-${index + 1}`,
    type: question.type,
    text: question.text,
    options: question.options || undefined,
    correct_answer: question.correct_answer,
    explanation: question.explanation,
  }));
}

function normalizeQuestionsWithSource(questions: any[]) {
  return questions.map((question, index) => ({
    id: question.id || `q-${index + 1}`,
    type: question.type,
    text: question.text,
    options: question.options || undefined,
    correct_answer: question.correct_answer,
    explanation: question.explanation,
    source_snippet:
      typeof question.source_snippet === "string"
        ? question.source_snippet.trim()
        : "",
  }));
}

function sanitizeStudyContent(raw: string): string {
  const pdfArtifactPattern =
    /\/BaseFont|\/Font|\/Type|\/Subtype|\/Length|\/Filter|\/ProcSet|\/ImageC|CIDInit|ProcSet|CMapName|begincmap|endcmap|beginbfchar|endbfchar|currentdict|defineresource|Adobe-Identity-UCS|Identity-H|obj\b|endobj|stream\b|endstream|xref|startxref|trailer|<<|>>|ascii85decode|flatedecode|reportlab|producer|creator|author\s*:|creationdate|moddate|pdf library/i;

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.length > 2 && line.length < 300)
    .filter((line) => !pdfArtifactPattern.test(line))
    .filter((line) => (line.match(/\//g) || []).length < 2);

  const seen = new Set<string>();
  const cleaned = lines.filter((line) => {
    if (seen.has(line)) return false;
    seen.add(line);
    const letterCount = (line.match(/[A-Za-z]/g) || []).length;
    const tokenCount = (line.match(/[A-Za-z]{2,}/g) || []).length;
    if (tokenCount < 3) return false;
    if (letterCount / Math.max(line.length, 1) < 0.45) return false;
    const uppercaseTokens = line.match(/\b[A-Z]{3,}\b/g) || [];
    if (uppercaseTokens.length > 6) return false;
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length < 5) return false;
    const naturalWords = words.filter((word) =>
      /^[A-Za-z][A-Za-z'’-]{2,}$/.test(word)
    );
    if (naturalWords.length / Math.max(words.length, 1) < 0.55) return false;
    const hasVowelWord = naturalWords.some((word) => /[aeiou]/i.test(word));
    if (!hasVowelWord) return false;
    if (/[A-Za-z0-9_$@#%!?;:,.=\-+\\/]{16,}/.test(line)) return false;
    return true;
  });

  // Prefer instructional lines over incidental headings.
  const ranked = cleaned.sort((a, b) => {
    const score = (line: string) => {
      let s = 0;
      if (/data|clean|error|analysis|method|value|tips|duplicate|missing|illegal|incorrect/i.test(line)) s += 3;
      if (/[:.]/.test(line)) s += 1;
      if (line.split(/\s+/).length >= 6) s += 2;
      return s;
    };
    return score(b) - score(a);
  });

  return ranked.join("\n").slice(0, 12000);
}

function hasHeavyPdfArtifacts(text: string): boolean {
  const artifactTokens =
    text.match(
      /\/BaseFont|\/Font|\/Type|\/Subtype|\/Length|\/Filter|\/ProcSet|CIDInit|CMapName|begincmap|beginbfchar|defineresource|Adobe-Identity-UCS|Identity-H|xref|startxref|trailer|endobj|endstream|ascii85decode|flatedecode|reportlab|pdf library/gi
    ) || [];
  return artifactTokens.length >= 4;
}

function hasSufficientNaturalLanguage(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 5) return false;
  const strongLines = lines.filter((line) => {
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length < 5) return false;
    const naturalWords = words.filter((word) =>
      /^[A-Za-z][A-Za-z'’-]{2,}$/.test(word)
    );
    return naturalWords.length / Math.max(words.length, 1) >= 0.55;
  });
  return strongLines.length >= 5;
}

function isLikelyArtifactQuestion(text: string): boolean {
  return /basefont|procset|cidinit|cmap|ascii85|flate|producer|creator|reportlab|pdf library|defineresource|identity-h|adobe-identity-ucs|xref|endobj|stream/i.test(
    text
  );
}

function isQuestionGrounded(
  question: {
    text?: string;
    explanation?: string;
    source_snippet?: string;
  },
  source: string
) {
  const snippet = (question.source_snippet || "").trim();
  if (!snippet || snippet.length < 12) return false;

  const sourceLower = source.toLowerCase();
  const snippetLower = snippet.toLowerCase();
  if (!sourceLower.includes(snippetLower)) return false;

  const combined = `${question.text || ""} ${question.explanation || ""}`.toLowerCase();
  const snippetTokens = snippetLower
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
  const uniqueTokens = Array.from(new Set(snippetTokens));
  if (uniqueTokens.length === 0) return false;

  const overlap = uniqueTokens.filter((token) => combined.includes(token)).length;
  return overlap >= 1;
}

export async function POST(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { success: false, error: "Missing OPENAI_API_KEY." },
      { status: 500 }
    );
  }

  const body = await request.json();
  const studyMaterialId = body?.studyMaterialId as string;
  const requestedQuestionCount =
    typeof body?.questionCount === "number" ? Number(body.questionCount) : null;
  const requestedDifficulty =
    typeof body?.difficulty === "number" ? Number(body.difficulty) : null;
  const requestedQuestionTypes = Array.isArray(body?.questionTypes)
    ? (body.questionTypes as QuizQuestionType[])
    : null;

  if (!studyMaterialId) {
    return NextResponse.json(
      { success: false, error: "Study material is required." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: material, error: materialError } = await supabase
    .from("study_materials")
    .select("id, title, content, source_id")
    .eq("id", studyMaterialId)
    .eq("user_id", userId)
    .single();

  if (materialError || !material) {
    void logEvent({
      userId,
      eventType: "quiz_generation_failed",
      workspace: "study_library",
      severity: "error",
      payload: { reason: "study_material_not_found", studyMaterialId },
    });
    return NextResponse.json(
      { success: false, error: "Study material not found." },
      { status: 404 }
    );
  }
  const materialMeta = parseMaterialMetadata(material.source_id);
  const quizDefaults = materialMeta.quizDefaults || DEFAULT_QUIZ_DEFAULTS;
  const questionCount = Math.max(
    5,
    Math.min(50, Number(requestedQuestionCount ?? quizDefaults.questionCount ?? 10))
  );
  const difficulty = Math.max(
    1,
    Math.min(5, Number(requestedDifficulty ?? quizDefaults.difficulty ?? 3))
  );
  const questionTypes = (
    requestedQuestionTypes && requestedQuestionTypes.length > 0
      ? requestedQuestionTypes
      : quizDefaults.questionTypes
  ) as QuizQuestionType[];
  const rawStudyContent = (material.content || "").trim();
  const studyContent = sanitizeStudyContent(rawStudyContent);
  const hasStrongSanitized =
    studyContent.length >= 300 && hasSufficientNaturalLanguage(studyContent);
  const hasUsableRaw =
    rawStudyContent.length >= 180 &&
    hasSufficientNaturalLanguage(rawStudyContent) &&
    !hasHeavyPdfArtifacts(rawStudyContent);

  const quizSourceContent = hasStrongSanitized
    ? studyContent
    : studyContent.length >= 120
    ? studyContent
    : rawStudyContent;

  // Only hard-fail when material is effectively empty.
  if (quizSourceContent.trim().length < 20) {
    void logEvent({
      userId,
      eventType: "quiz_generation_failed",
      workspace: "study_library",
      severity: "error",
      payload: { reason: "source_content_too_short", studyMaterialId },
    });
    void logEvent({
      userId,
      eventType: "quiz_generation_failed",
      workspace: "study_library",
      severity: "error",
      payload: {
        phase: "fallback",
        reason: "insufficient_questions_after_fallback",
        studyMaterialId,
      },
    });
    return NextResponse.json(
      {
        success: false,
        error:
          "Study material content is too short to generate a quiz. Add more text and try again.",
      },
      { status: 400 }
    );
  }

  const systemPrompt = `You are generating a quiz from study material.
Return JSON: { "questions": [ { "id": "q-1", "type": "multiple_choice|true_false|short_answer|essay", "text": "...", "options": [], "correct_answer": "...", "explanation": "...", "source_snippet": "exact quote from material" } ] }

Rules:
- Total questions: ${questionCount}
- Types: ${questionTypes.join(", ")}
- Difficulty: ${difficulty}/5
- Questions must test understanding.
- Provide correct_answer and explanation for all types except essay.
- Use ONLY facts explicitly stated in the provided study material.
- If a fact is not in the material, do not invent it.
- Prefer terminology and phrasing from the study material.
- Ignore document artifact tokens (examples: /BaseFont, CIDInit, ProcSet, CMapName, xref, obj, stream).
- Never ask about PDF/document metadata, encodings, fonts, producer/author fields, compression filters, or library internals.
- Every question MUST include source_snippet as an exact quote from the study material.`;

  const userPrompt = `STUDY MATERIAL:\n${quizSourceContent}`;

  const generateCandidate = async () => {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    const json = JSON.parse(
      response.choices[0]?.message?.content || "{\"questions\":[]}"
    );
    return normalizeQuestionsWithSource(json.questions || []);
  };

  const generateFallbackCandidate = async () => {
    const fallbackSystemPrompt = `You are generating a quiz from study material.
Return JSON: { "questions": [ { "id": "q-1", "type": "multiple_choice|true_false|short_answer|essay", "text": "...", "options": [], "correct_answer": "...", "explanation": "...", "source_snippet": "exact quote from material" } ] }

Rules:
- Total questions: ${questionCount}
- Types: ${questionTypes.join(", ")}
- Difficulty: ${difficulty}/5
- Use only the provided material.
- Do not include document metadata or PDF internals.
- Keep answers concise and accurate.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: fallbackSystemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    const json = JSON.parse(
      response.choices[0]?.message?.content || "{\"questions\":[]}"
    );
    return normalizeQuestionsWithSource(json.questions || []);
  };

  let candidates = await generateCandidate();
  let grounded = candidates.filter((question) =>
    isQuestionGrounded(question, quizSourceContent)
  );
  grounded = grounded.filter(
    (question) =>
      !isLikelyArtifactQuestion(
        `${question.text || ""} ${question.explanation || ""} ${
          question.source_snippet || ""
        }`
      )
  );

  if (grounded.length < Math.max(3, Math.floor(questionCount * 0.6))) {
    candidates = await generateCandidate();
    grounded = candidates.filter((question) =>
      isQuestionGrounded(question, quizSourceContent)
    );
    grounded = grounded.filter(
      (question) =>
        !isLikelyArtifactQuestion(
          `${question.text || ""} ${question.explanation || ""} ${
            question.source_snippet || ""
          }`
        )
    );
  }

  let selectedWithSource = (grounded.length ? grounded : candidates).slice(
    0,
    questionCount
  );
  let questions = normalizeQuestions(selectedWithSource);

  if (questions.length < Math.max(3, Math.floor(questionCount * 0.5))) {
    const fallbackQuestions = await generateFallbackCandidate();
    let usableFallback = fallbackQuestions
      .filter((question) =>
        !isLikelyArtifactQuestion(
          `${question.text || ""} ${question.explanation || ""} ${
            question.source_snippet || ""
          }`
        )
      )
      .slice(0, questionCount);

    let fallbackValidation = validateQuizOutput(
      usableFallback,
      quizSourceContent
    );
    if (!fallbackValidation.passed) {
      void logEvent({
        userId,
        eventType: "quiz_generation_low_quality",
        workspace: "study_library",
        severity: "warn",
        payload: {
          phase: "fallback",
          reason: fallbackValidation.reason,
          studyMaterialId,
        },
      });
      const fallbackRetry = await generateFallbackCandidate();
      usableFallback = fallbackRetry
        .filter((question) =>
          !isLikelyArtifactQuestion(
            `${question.text || ""} ${question.explanation || ""} ${
              question.source_snippet || ""
            }`
          )
        )
        .slice(0, questionCount);
      fallbackValidation = validateQuizOutput(usableFallback, quizSourceContent);
    }

    if (!fallbackValidation.passed) {
      void logEvent({
        userId,
        eventType: "quiz_generation_failed",
        workspace: "study_library",
        severity: "error",
        payload: {
          phase: "fallback",
          reason: fallbackValidation.reason,
          studyMaterialId,
        },
      });
      return NextResponse.json(
        {
          success: false,
          error: `Quiz quality guard failed: ${fallbackValidation.reason}`,
        },
        { status: 400 }
      );
    }

    if (usableFallback.length >= Math.max(3, Math.floor(questionCount * 0.5))) {
      const { data: fallbackQuiz, error: fallbackInsertError } = await supabase
        .from("quizzes")
        .insert({
          user_id: userId,
          study_material_id: studyMaterialId,
          title: `${material.title} Quiz`,
          questions: normalizeQuestions(usableFallback),
          difficulty,
        })
        .select("id, title")
        .single();

      if (fallbackInsertError || !fallbackQuiz) {
        void logEvent({
          userId,
          eventType: "quiz_generation_failed",
          workspace: "study_library",
          severity: "error",
          payload: {
            phase: "fallback",
            reason: "quiz_save_failed",
            studyMaterialId,
          },
        });
        return NextResponse.json(
          {
            success: false,
            error: fallbackInsertError?.message || "Quiz save failed.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          quizId: fallbackQuiz.id,
          title: fallbackQuiz.title,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "Could not generate enough quiz questions from this material yet. Try increasing material detail and try again.",
      },
      { status: 400 }
    );
  }

  let quizValidation = validateQuizOutput(selectedWithSource, quizSourceContent);
  if (!quizValidation.passed) {
    void logEvent({
      userId,
      eventType: "quiz_generation_low_quality",
      workspace: "study_library",
      severity: "warn",
      payload: {
        phase: "primary",
        reason: quizValidation.reason,
        studyMaterialId,
      },
    });
    const retryCandidates = await generateCandidate();
    const retryGrounded = retryCandidates.filter((question) =>
      isQuestionGrounded(question, quizSourceContent)
    );
    selectedWithSource = (retryGrounded.length ? retryGrounded : retryCandidates)
      .filter(
        (question) =>
          !isLikelyArtifactQuestion(
            `${question.text || ""} ${question.explanation || ""} ${
              question.source_snippet || ""
            }`
          )
      )
      .slice(0, questionCount);
    questions = normalizeQuestions(selectedWithSource);
    quizValidation = validateQuizOutput(selectedWithSource, quizSourceContent);
  }

  if (!quizValidation.passed) {
    void logEvent({
      userId,
      eventType: "quiz_generation_failed",
      workspace: "study_library",
      severity: "error",
      payload: { phase: "primary", reason: quizValidation.reason, studyMaterialId },
    });
    return NextResponse.json(
      {
        success: false,
        error: `Quiz quality guard failed: ${quizValidation.reason}`,
      },
      { status: 400 }
    );
  }

  const { data: quiz, error: insertError } = await supabase
    .from("quizzes")
    .insert({
      user_id: userId,
      study_material_id: studyMaterialId,
      title: `${material.title} Quiz`,
      questions,
      difficulty,
    })
    .select("id, title")
    .single();

  if (insertError || !quiz) {
    void logEvent({
      userId,
      eventType: "quiz_generation_failed",
      workspace: "study_library",
      severity: "error",
      payload: { phase: "primary", reason: "quiz_save_failed", studyMaterialId },
    });
    return NextResponse.json(
      { success: false, error: insertError?.message || "Quiz save failed." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, quizId: quiz.id, title: quiz.title },
    { status: 200 }
  );
}
