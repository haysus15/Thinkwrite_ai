// src/app/api/quiz/submit/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { QuizQuestion, QuizResultItem } from "@/types/academic-studio";

export const runtime = "nodejs";

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

function normalizeAnswer(answer: unknown) {
  if (typeof answer === "string") return answer.trim();
  if (typeof answer === "boolean") return answer;
  return answer;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const answers = body?.answers || {};

  const supabase = await createSupabaseServerClient();
  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .select("id, title, questions")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single();

  if (quizError || !quiz) {
    return NextResponse.json(
      { success: false, error: "Quiz not found." },
      { status: 404 }
    );
  }

  const claudeKey = getClaudeApiKey();
  if (!claudeKey) {
    return NextResponse.json(
      { success: false, error: "Missing CLAUDE_API_KEY." },
      { status: 500 }
    );
  }

  const anthropic = new Anthropic({ apiKey: claudeKey });
  const questions = quiz.questions as QuizQuestion[];
  const results: QuizResultItem[] = [];

  let totalPoints = 0;
  let earnedPoints = 0;
  let gradableCount = 0;

  for (const question of questions) {
    const answer = normalizeAnswer(answers[question.id]);
    let result: QuizResultItem = {
      questionId: question.id,
      type: question.type,
      correct: null,
      points: null,
      correctAnswer: question.correct_answer,
    };

    if (question.type === "multiple_choice" || question.type === "true_false") {
      const isCorrect = answer === question.correct_answer;
      result = {
        ...result,
        correct: isCorrect,
        points: isCorrect ? 1 : 0,
        feedback: question.explanation,
      };
      totalPoints += 1;
      earnedPoints += isCorrect ? 1 : 0;
      gradableCount += 1;
    } else if (question.type === "short_answer") {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: `You are grading a short answer. Return JSON: {"correct": true/false, "points": 0-1, "feedback": "..."}`,
        messages: [
          {
            role: "user",
            content: `QUESTION: ${question.text}
EXPECTED: ${question.correct_answer}
STUDENT: ${answer}`,
          },
        ],
      });
      const parsed = JSON.parse(response.content?.[0]?.text || "{}");
      result = {
        ...result,
        correct: Boolean(parsed.correct),
        points: Number(parsed.points ?? 0),
        feedback: parsed.feedback || "",
      };
      totalPoints += 1;
      earnedPoints += Number(parsed.points ?? 0);
      gradableCount += 1;
    } else if (question.type === "essay") {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        system: `You are Victor reviewing an essay response. Provide constructive feedback, no score.`,
        messages: [
          {
            role: "user",
            content: `QUESTION: ${question.text}\nSTUDENT ESSAY:\n${answer}`,
          },
        ],
      });
      result = {
        ...result,
        correct: null,
        points: null,
        feedback: response.content?.[0]?.text || "",
      };
    }

    results.push(result);
  }

  const score =
    gradableCount > 0 ? Number(((earnedPoints / totalPoints) * 100).toFixed(2)) : 0;

  const { data: attempt, error: attemptError } = await supabase
    .from("quiz_attempts")
    .insert({
      quiz_id: quiz.id,
      user_id: userId,
      answers,
      results,
      score,
      correct_count: earnedPoints,
      total_questions: totalPoints,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (attemptError || !attempt) {
    return NextResponse.json(
      { success: false, error: attemptError?.message || "Save failed." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      attemptId: attempt.id,
      score,
      results,
    },
    { status: 200 }
  );
}
