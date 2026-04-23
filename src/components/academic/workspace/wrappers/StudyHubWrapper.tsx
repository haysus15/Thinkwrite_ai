"use client";

import StudyHub from "@/components/academic/study-hub/StudyHub";

export function StudyHubWrapper({
  assignmentId,
}: {
  assignmentId?: string | null;
}) {
  return (
    <div className="studio-workspace-content">
      <StudyHub assignmentId={assignmentId ?? undefined} />
    </div>
  );
}
