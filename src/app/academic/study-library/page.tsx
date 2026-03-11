import { redirect } from "next/navigation";

export default function AcademicStudyLibraryLegacyPage() {
  redirect("/academic/study-hub?tab=library");
}
