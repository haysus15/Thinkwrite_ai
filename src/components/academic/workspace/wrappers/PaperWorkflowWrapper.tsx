"use client";

import PaperWorkflowContainer from "@/components/academic/paper-workflow/PaperWorkflowContainer";
import { VictorChatProvider } from "@/components/academic/victor-chat/VictorChatContext";

interface PaperWorkflowWrapperProps {
  assignmentId?: string | null;
  paperId?: string | null;
  setId?: string | null;
}

export function PaperWorkflowWrapper({
  assignmentId,
  paperId,
  setId,
}: PaperWorkflowWrapperProps) {
  return (
    <div className="studio-workspace-content">
      <VictorChatProvider>
        <PaperWorkflowContainer
          initialPaperId={paperId ?? undefined}
          setContextId={setId ?? undefined}
          assignmentId={assignmentId ?? undefined}
        />
      </VictorChatProvider>
    </div>
  );
}
