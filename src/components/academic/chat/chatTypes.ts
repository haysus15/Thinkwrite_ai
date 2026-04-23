"use client";

import type { StudioKey } from "@/components/academic/workspace/studioRegistry";

export type AcademicChatMessageRole = "user" | "travis" | "victor" | "system";

export type AcademicChatStudio =
  | "paper"
  | "math"
  | "study"
  | "agenda"
  | "code_review"
  | "unclear";

export type AcademicChatConfidence = "high" | "low";

export type AcademicChatExtractedData = {
  topic?: string;
  className?: string;
  assignmentType?: string;
  dueDate?: string;
  assignmentName?: string;
  requirements?: {
    minSources?: number;
    citationFormat?: string;
    pageCount?: string;
    wordCount?: string;
    minSections?: number;
    requiredSections?: string[];
  };
};

export type AcademicIntentResult = {
  studio: AcademicChatStudio;
  confidence: AcademicChatConfidence;
  extractedData: AcademicChatExtractedData;
  clarifyingQuestion?: string;
};

export type AcademicChatMessage = {
  id: string;
  role: AcademicChatMessageRole;
  text: string;
  timestamp: string;
};

export type AcademicWorkspaceContext =
  | {
      type: "idle";
    }
  | {
      type: "dashboard";
    }
  | {
      type: "studio";
      studio: StudioKey;
      assignmentId?: string | null;
      paperId?: string | null;
      reviewId?: string | null;
      setId?: string | null;
    };

export type AcademicChatUploadContext = {
  fileName: string;
  message: string;
};

export interface AcademicSettings {
  sessionEntryPreference: "chat_first" | "direct";
  travisSessionMemory: boolean;
  victorAvailability: "workflow_only" | "always";
}

export const DEFAULT_ACADEMIC_SETTINGS: AcademicSettings = {
  sessionEntryPreference: "chat_first",
  travisSessionMemory: true,
  victorAvailability: "workflow_only",
};
