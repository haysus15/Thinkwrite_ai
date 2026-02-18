// Application workspace event bus
// src/lib/career-studio/applicationBus.ts

'use client';

export interface ApplicationScorePayload {
  applicationId: string;
  score: {
    resumeScore: number;
    coverLetterScore: number;
    applicationScore: number;
    scoredAt?: string;
  };
  resumeAnalysis?: any;
  coverLetterBreakdown?: {
    overall?: number;
    voiceMatch?: number;
    jobAlignment?: number;
  };
}

const APPLICATION_SCORE_EVENT = 'career-studio:application-score';

export function dispatchApplicationScore(payload: ApplicationScorePayload) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ApplicationScorePayload>(APPLICATION_SCORE_EVENT, { detail: payload }));
}

export function subscribeToApplicationScore(handler: (payload: ApplicationScorePayload) => void) {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<ApplicationScorePayload>;
    if (!customEvent.detail?.applicationId) return;
    handler(customEvent.detail);
  };
  window.addEventListener(APPLICATION_SCORE_EVENT, listener as EventListener);
  return () => window.removeEventListener(APPLICATION_SCORE_EVENT, listener as EventListener);
}
