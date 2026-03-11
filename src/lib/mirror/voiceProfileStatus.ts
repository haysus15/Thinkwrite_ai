export type ProfileState = "empty" | "learning" | "ready" | "strong";

export interface ChamberStatus {
  state: ProfileState;
  displayLabel: string;
  documentCount: number;
  confidenceScore: number;
  nextMilestone: string;
  progressToNext: number;
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getChamberStatus(
  documentCount: number,
  confidenceScore: number
): ChamberStatus {
  if (documentCount === 0) {
    return {
      state: "empty",
      displayLabel: "Not started",
      documentCount,
      confidenceScore,
      nextMilestone: "Upload your first writing sample to begin.",
      progressToNext: 0,
    };
  }

  if (confidenceScore < 35) {
    return {
      state: "learning",
      displayLabel: "Learning",
      documentCount,
      confidenceScore,
      nextMilestone:
        "Upload 1-2 more samples so Mirror Mode can identify your patterns.",
      progressToNext: clampProgress((confidenceScore / 35) * 100),
    };
  }

  if (confidenceScore < 70) {
    return {
      state: "ready",
      displayLabel: "Ready",
      documentCount,
      confidenceScore,
      nextMilestone:
        "A few more samples will strengthen your voice profile significantly.",
      progressToNext: clampProgress(((confidenceScore - 35) / 35) * 100),
    };
  }

  return {
    state: "strong",
    displayLabel: "Strong",
    documentCount,
    confidenceScore,
    nextMilestone:
      "Your voice profile is well established. Keep writing to refine it further.",
    progressToNext: 100,
  };
}

export function translateSystemError(errorCode: string): string {
  const normalized = String(errorCode || "UNKNOWN").trim();
  const upper = normalized.toUpperCase();

  const errorMap: Record<string, string> = {
    PARSE_FAILED:
      "This file could not be read. Try a different format. DOCX and TXT work most reliably.",
    TOO_SHORT:
      "This sample is too short to learn from. Upload something at least two paragraphs long.",
    NO_TEXT_DETECTED:
      "No readable text was found in this file. Scanned images and locked PDFs cannot be processed.",
    DUPLICATE_DETECTED: "This document has already been added to your profile.",
    UNKNOWN:
      "Something went wrong processing this file. Try again or upload a different document.",
  };

  if (errorMap[upper]) return errorMap[upper];

  const lowered = normalized.toLowerCase();

  if (
    lowered.includes("unauthorized") ||
    lowered.includes("authentication required") ||
    lowered.includes("auth")
  ) {
    return "Your session expired. Sign in again to continue.";
  }

  if (
    lowered.includes("empty text") ||
    lowered.includes("extracted empty text") ||
    lowered.includes("no readable text") ||
    lowered.includes("no text")
  ) {
    return errorMap.NO_TEXT_DETECTED;
  }

  if (lowered.includes("too short") || lowered.includes("at least 100 characters")) {
    return errorMap.TOO_SHORT;
  }

  if (lowered.includes("duplicate")) {
    return errorMap.DUPLICATE_DETECTED;
  }

  if (lowered.includes("invalid file type") || lowered.includes("unsupported file type")) {
    return "This file type is not supported. Upload PDF, DOCX, or TXT.";
  }

  if (lowered.includes("file too large")) {
    return "This file is too large. Upload a file under 10MB.";
  }

  if (
    lowered.includes("failed to load chat") ||
    lowered.includes("ursie is unavailable") ||
    lowered.includes("failed to send message")
  ) {
    return "Ursie is unavailable right now. Try again in a moment.";
  }

  if (lowered.includes("failed to save chat")) {
    return "Unable to save this chat right now. Try again.";
  }

  if (lowered.includes("failed to start new chat")) {
    return "Unable to start a new chat right now. Try again.";
  }

  if (lowered.includes("failed to save memory") || lowered.includes("memory note required")) {
    return "Unable to save this memory note right now. Try again.";
  }

  if (lowered.includes("failed to reset") || lowered.includes("failed to hide documents")) {
    return "Could not reset your Mirror Mode profile right now. Try again.";
  }

  if (lowered.includes("document not found")) {
    return "That document is no longer available.";
  }

  if (lowered.includes("internal server error")) {
    return "Something went wrong on our side. Try again.";
  }

  return errorMap.UNKNOWN;
}
