"use client";

import { useCallback, useState } from "react";
import { toDateInputValue } from "@/lib/academic/dueDate";

export type SyllabusDraftRow = {
  id: string;
  class_name: string;
  assignment_name: string;
  assignment_type: string | null;
  due_date: string | null;
  requirements: Record<string, unknown> | null;
  grading_weight: number | null;
  draft_status: "parsed" | "edited" | "approved" | "rejected" | "published";
};

export type DraftReviewRow = {
  id: string;
  class_name: string;
  assignment_name: string;
  assignment_type: string;
  due_date: string;
  grading_weight: string;
  approved: boolean;
};

export function useSyllabusReview(options: { onPublished?: () => Promise<void> | void } = {}) {
  const { onPublished } = options;

  const [uploading, setUploading] = useState(false);
  const [parsedSyllabusId, setParsedSyllabusId] = useState<string | null>(null);
  const [reviewClassName, setReviewClassName] = useState<string>("");
  const [reviewDrafts, setReviewDrafts] = useState<DraftReviewRow[]>([]);
  const [publishing, setPublishing] = useState(false);

  const approvedCount = reviewDrafts.filter((draft) => draft.approved).length;

  const loadSyllabusReview = useCallback(async (syllabusId: string) => {
    const response = await fetch(`/api/travis/syllabus/${syllabusId}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to load syllabus review.");
    }

    const drafts: SyllabusDraftRow[] = data.drafts || [];
    setReviewClassName(data.syllabus?.class_name || "");
    setReviewDrafts(
      drafts.map((draft) => ({
        id: draft.id,
        class_name: draft.class_name || data.syllabus?.class_name || "",
        assignment_name: draft.assignment_name || "",
        assignment_type: draft.assignment_type || "",
        due_date: toDateInputValue(draft.due_date),
        grading_weight:
          typeof draft.grading_weight === "number" ? String(draft.grading_weight) : "",
        approved: draft.draft_status !== "rejected",
      }))
    );
  }, []);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/travis/syllabus/upload", {
          method: "POST",
          body: form,
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Upload failed.");
        }
        setParsedSyllabusId(data.syllabus.id);
        await loadSyllabusReview(data.syllabus.id);
      } finally {
        setUploading(false);
      }
    },
    [loadSyllabusReview]
  );

  const publishReviewedSyllabus = useCallback(async () => {
    if (!parsedSyllabusId) return;
    setPublishing(true);
    try {
      const draftsPayload = reviewDrafts.map((draft) => {
        const parsedWeight = Number(draft.grading_weight);
        return {
          id: draft.id,
          class_name: draft.class_name.trim(),
          assignment_name: draft.assignment_name.trim(),
          assignment_type: draft.assignment_type.trim() || null,
          due_date: draft.due_date || null,
          grading_weight:
            draft.grading_weight.trim() === ""
              ? null
              : Number.isFinite(parsedWeight)
                ? parsedWeight
                : null,
          approved: draft.approved,
          rejected: !draft.approved,
        };
      });

      const response = await fetch(`/api/travis/syllabus/confirm/${parsedSyllabusId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approve_all: false,
          drafts: draftsPayload,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Approve and publish failed.");
      }
      setParsedSyllabusId(null);
      setReviewClassName("");
      setReviewDrafts([]);
      await onPublished?.();
    } finally {
      setPublishing(false);
    }
  }, [onPublished, parsedSyllabusId, reviewDrafts]);

  return {
    uploading,
    parsedSyllabusId,
    reviewClassName,
    reviewDrafts,
    publishing,
    approvedCount,
    setReviewDrafts,
    handleUpload,
    publishReviewedSyllabus,
  };
}
