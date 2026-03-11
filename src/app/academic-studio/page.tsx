// Legacy route retained for backwards compatibility.
// Canonical route: /academic-studio/welcome
import { redirect } from "next/navigation";

export default function AcademicStudioPage() {
  redirect("/academic-studio/welcome");
}
