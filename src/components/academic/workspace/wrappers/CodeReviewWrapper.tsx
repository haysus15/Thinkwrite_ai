"use client";

import CodeReviewHome from "@/components/academic/coding-review/CodeReviewHome";
import CodingReviewPanel from "@/components/academic/coding-review/CodingReviewPanel";
import { VictorChatProvider } from "@/components/academic/victor-chat/VictorChatContext";

interface CodeReviewWrapperProps {
  assignmentId?: string | null;
  reviewId?: string | null;
  setId?: string | null;
}

export function CodeReviewWrapper({
  assignmentId,
  reviewId,
  setId,
}: CodeReviewWrapperProps) {
  const showReviewPanel = Boolean(assignmentId || reviewId || setId);

  return (
    <div className="studio-workspace-content">
      <VictorChatProvider>
        {showReviewPanel ? (
          <CodingReviewPanel
            assignmentId={assignmentId ?? undefined}
            initialReviewId={reviewId ?? undefined}
            setContextId={setId ?? undefined}
          />
        ) : (
          <CodeReviewHome />
        )}
      </VictorChatProvider>
    </div>
  );
}
