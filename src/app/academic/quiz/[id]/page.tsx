import QuizInterface from "@/components/academic-studio/quiz/QuizInterface";

export default async function AcademicQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuizInterface quizId={id} />;
}
