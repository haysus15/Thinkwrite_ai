"use client";

import type { WorkspaceView } from "@/types/career-studio-workspace";

export interface LexPromptPayload {
  prompt: string;
  workspace?: WorkspaceView;
  resumeId?: string;
  jobId?: string;
  intent?: "recruiter-review" | "quote-review" | "general";
  contextTag?: "tailor-strategy" | "tailor-edit-passes";
  displayPrompt?: string;
}

const LEX_PROMPT_EVENT = "career-studio:lex-prompt";
const RESUME_UPDATED_EVENT = "career-studio:resume-updated";
const RECRUITER_REVIEW_EVENT = "career-studio:recruiter-review";
const QUOTE_REVIEW_EVENT = "career-studio:quote-review";
const STRATEGY_SUMMARY_EVENT = "career-studio:strategy-summary";

export function dispatchLexPrompt(payload: LexPromptPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<LexPromptPayload>(LEX_PROMPT_EVENT, { detail: payload }));
}

export function subscribeToLexPrompts(handler: (payload: LexPromptPayload) => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<LexPromptPayload>;
    if (!customEvent.detail?.prompt) return;
    handler(customEvent.detail);
  };

  window.addEventListener(LEX_PROMPT_EVENT, listener as EventListener);
  return () => window.removeEventListener(LEX_PROMPT_EVENT, listener as EventListener);
}

export interface ResumeUpdatedPayload {
  resumeId: string;
}

export function dispatchResumeUpdated(payload: ResumeUpdatedPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ResumeUpdatedPayload>(RESUME_UPDATED_EVENT, { detail: payload }));
}

export function subscribeToResumeUpdated(handler: (payload: ResumeUpdatedPayload) => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<ResumeUpdatedPayload>;
    if (!customEvent.detail?.resumeId) return;
    handler(customEvent.detail);
  };

  window.addEventListener(RESUME_UPDATED_EVENT, listener as EventListener);
  return () => window.removeEventListener(RESUME_UPDATED_EVENT, listener as EventListener);
}

export interface RecruiterReviewSuggestion {
  before: string;
  after: string;
}

export interface RecruiterReviewPayload {
  resumeId: string;
  suggestions: RecruiterReviewSuggestion[];
}

export function dispatchRecruiterReview(payload: RecruiterReviewPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<RecruiterReviewPayload>(RECRUITER_REVIEW_EVENT, { detail: payload }));
}

export function subscribeToRecruiterReview(handler: (payload: RecruiterReviewPayload) => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<RecruiterReviewPayload>;
    if (!customEvent.detail?.resumeId) return;
    handler(customEvent.detail);
  };

  window.addEventListener(RECRUITER_REVIEW_EVENT, listener as EventListener);
  return () => window.removeEventListener(RECRUITER_REVIEW_EVENT, listener as EventListener);
}

export interface QuoteReviewPayload {
  resumeId: string;
  response: string;
  timestamp?: string;
}

export function dispatchQuoteReview(payload: QuoteReviewPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<QuoteReviewPayload>(QUOTE_REVIEW_EVENT, { detail: payload }));
}

export function subscribeToQuoteReview(handler: (payload: QuoteReviewPayload) => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<QuoteReviewPayload>;
    if (!customEvent.detail?.resumeId) return;
    handler(customEvent.detail);
  };

  window.addEventListener(QUOTE_REVIEW_EVENT, listener as EventListener);
  return () => window.removeEventListener(QUOTE_REVIEW_EVENT, listener as EventListener);
}

export interface StrategySummaryPayload {
  resumeId?: string;
  jobId?: string;
  text: string;
  contextTag?: "tailor-strategy" | "tailor-edit-passes";
}

export function dispatchStrategySummary(payload: StrategySummaryPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<StrategySummaryPayload>(STRATEGY_SUMMARY_EVENT, { detail: payload }));
}

export function subscribeToStrategySummary(handler: (payload: StrategySummaryPayload) => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<StrategySummaryPayload>;
    if (!customEvent.detail?.text) return;
    handler(customEvent.detail);
  };

  window.addEventListener(STRATEGY_SUMMARY_EVENT, listener as EventListener);
  return () => window.removeEventListener(STRATEGY_SUMMARY_EVENT, listener as EventListener);
}
