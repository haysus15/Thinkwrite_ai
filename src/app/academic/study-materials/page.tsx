import { redirect } from "next/navigation";

export default function AcademicStudyMaterialsLegacyPage() {
  redirect("/academic/study-hub?tab=ingest");
}
