'use client';

import { createContext, useContext, useState } from 'react';
import type { RecruiterReviewSuggestion } from '@/lib/career-studio/lexBus';

export interface ResumeManagerResultsPanelData {
  active: boolean;
  openDraftEditorSignal: number;
  quoteReviewLoading: boolean;
  quoteReviewResponse: string | null;
  reviewSource: "recruiter" | "quote" | null;
  scoredQuoteCount: number;
  ruleIssues: Array<{
    severity: "high" | "medium" | "low";
    category: "structure" | "format" | "verbiage" | "impact" | "ats";
    issue: string;
    evidence?: string;
    recommendation?: string;
  }>;
  appliedSuggestions: Array<RecruiterReviewSuggestion & { id: string; accepted: boolean; applied: boolean }>;
  onToggleSuggestion: (id: string, accepted: boolean) => void;
  onOpenFullChat: () => void;
  onRecruiterReview: () => void;
  onExplainScore: () => void;
  onFixBullets: () => void;
  onJumpToScoredQuotes: () => void;
  onExplainResumeWideIssues: () => void;
  onFixResumeWideIssues: () => void;
  originalResumeText: string;
  draftResumeText: string;
  draftDirty: boolean;
  draftSaving: boolean;
  draftSaveError: string | null;
  onDraftChange: (value: string) => void;
  onResetDraft: () => void;
  onSaveDraft: () => void;
}

interface ResumeManagerPanelContextValue {
  panel: ResumeManagerResultsPanelData | null;
  setPanel: (panel: ResumeManagerResultsPanelData | null) => void;
}

const ResumeManagerPanelContext = createContext<ResumeManagerPanelContextValue | null>(null);

export function ResumeManagerPanelProvider({ children }: { children: React.ReactNode }) {
  const [panel, setPanel] = useState<ResumeManagerResultsPanelData | null>(null);

  return (
    <ResumeManagerPanelContext.Provider value={{ panel, setPanel }}>
      {children}
    </ResumeManagerPanelContext.Provider>
  );
}

export function useResumeManagerPanel() {
  const context = useContext(ResumeManagerPanelContext);
  if (!context) {
    return { panel: null, setPanel: () => {} };
  }
  return context;
}
