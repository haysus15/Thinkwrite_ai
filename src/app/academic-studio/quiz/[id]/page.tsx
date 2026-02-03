// src/app/academic-studio/quiz/[id]/page.tsx
import QuizInterface from "@/components/academic-studio/quiz/QuizInterface";

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuizInterface quizId={id} />;
}
