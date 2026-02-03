// src/app/api/quiz/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { QuizQuestion, QuizQuestionType } from "@/types/academic-studio";

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
  const questionCount = Number(body?.questionCount || 10);
  const difficulty = Number(body?.difficulty || 3);
  const questionTypes = (body?.questionTypes ||
    []) as QuizQuestionType[];

  if (!studyMaterialId) {
    return NextResponse.json(
      { success: false, error: "Study material is required." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: material, error: materialError } = await supabase
    .from("study_materials")
    .select("id, title, content")
    .eq("id", studyMaterialId)
    .eq("user_id", userId)
    .single();

  if (materialError || !material) {
    return NextResponse.json(
      { success: false, error: "Study material not found." },
      { status: 404 }
    );
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are generating a quiz from study material.
Return JSON: { "questions": [ { "id": "q-1", "type": "multiple_choice|true_false|short_answer|essay", "text": "...", "options": [], "correct_answer": "...", "explanation": "..." } ] }

Rules:
- Total questions: ${questionCount}
- Types: ${questionTypes.join(", ")}
- Difficulty: ${difficulty}/5
- Questions must test understanding.
- Provide correct_answer and explanation for all types except essay.`,
      },
      {
        role: "user",
        content: `STUDY MATERIAL:\n${material.content}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const json = JSON.parse(
    response.choices[0]?.message?.content || "{\"questions\":[]}"
  );
  const questions = normalizeQuestions(json.questions || []);

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
