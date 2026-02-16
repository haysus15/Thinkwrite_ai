'use client';

import { createContext, useContext, useState } from 'react';

export interface ResumeManagerResultsPanelData {
  active: boolean;
  openDraftEditorSignal: number;
  originalResumeText: string;
  draftResumeText: string;
  draftDirty: boolean;
  draftSaving: boolean;
  draftSaveError: string | null;
  inlineSuggestions?: Array<{
    id: string;
    currentLine: string;
    suggestedFix: string;
  }>;
  onApplySuggestion?: (id: string) => void;
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
