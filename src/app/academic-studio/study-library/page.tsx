// src/app/academic-studio/study-library/page.tsx
import { redirect } from "next/navigation";

export default function StudyLibraryPage() {
  redirect("/academic-studio/dashboard?workspace=study-library");
}
