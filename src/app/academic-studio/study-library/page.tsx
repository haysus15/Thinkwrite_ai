// Legacy route retained for backwards compatibility.
// Canonical route: /academic/study-hub?tab=library
import { redirect } from "next/navigation";

export default function StudyLibraryPage() {
  redirect("/academic/study-hub?tab=library");
}
