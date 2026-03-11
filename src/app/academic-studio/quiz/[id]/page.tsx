// Legacy route retained for backwards compatibility.
// Canonical route: /academic/quiz/[id]
import { redirect } from "next/navigation";

export default async function LegacyAcademicQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/academic/quiz/${id}`);
}
