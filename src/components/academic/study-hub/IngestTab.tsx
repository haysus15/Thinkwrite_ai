"use client";

import AcademicEmptyState from "@/components/academic-studio/shared/AcademicEmptyState";
import type { AttemptItem, MaterialItem, QuizItem } from "./types";
import UploadMaterialForm from "./UploadMaterialForm";

type Props = {
  materials: MaterialItem[];
  quizzes: QuizItem[];
  attempts: AttemptItem[];
  onUploadComplete: (result: { materialId: string; materialTitle: string }) => Promise<void>;
  onOpenLibrary: () => void;
};

export default function IngestTab({
  materials,
  quizzes,
  attempts,
  onUploadComplete,
  onOpenLibrary,
}: Props) {
  const classOptions = Array.from(
    new Set(materials.map((item) => item.class_name || "").filter(Boolean))
  );
  const hasAnyAttempt = attempts.length > 0 || quizzes.length > 0;

  return (
    <div className="space-y-4">
      <UploadMaterialForm
        mode="inline"
        classOptions={classOptions}
        onUploaded={onUploadComplete}
      />

      {materials.length > 0 && !hasAnyAttempt && (
        <AcademicEmptyState
          title={`You have ${materials.length} material(s) in your library`}
          description="Ready to test yourself? Go to Library to generate your first quiz."
          action={{
            label: "Open Library",
            onClick: onOpenLibrary,
          }}
          className="academic-nested-card !min-h-0 rounded-2xl py-4"
        />
      )}
    </div>
  );
}
