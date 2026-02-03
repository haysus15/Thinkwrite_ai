// src/app/academic-studio/quiz/[id]/page.tsx
import QuizInterface from "@/components/academic-studio/quiz/QuizInterface";

export default function QuizPage({ params }: { params: { id: string } }) {
  return <QuizInterface quizId={params.id} />;
}
