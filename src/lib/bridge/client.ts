"use client";

import { detectLanguage } from "@/lib/language/detectLanguage";

export interface BridgeTransferResult {
  didTransfer: boolean;
  workingText: string;
  englishOutput: string | null;
  profileVersion: 1 | 2 | null;
}

export async function shouldRunBridgeTransfer(
  input: string,
  sourceLanguage: string,
  threshold = 0.7
): Promise<boolean> {
  if (!input.trim() || !sourceLanguage) {
    return false;
  }

  const detection = await detectLanguage(input);
  return detection.confidence >= threshold && detection.language === sourceLanguage;
}

export async function runBridgeTransfer(
  sourceInput: string,
  options?: { context?: string }
): Promise<BridgeTransferResult> {
  const response = await fetch("/api/mirror-mode/voice/generate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      type: "freeform",
      prompt: sourceInput,
      outputLanguage: "en",
      context: options?.context,
    }),
  });

  const data = await response.json();
  if (!response.ok || typeof data?.generated?.text !== "string" || !data.generated.text.trim()) {
    throw new Error(data?.error || "Bridge transfer failed.");
  }

  return {
    didTransfer: true,
    workingText: data.generated.text.trim(),
    englishOutput: data.generated.text.trim(),
    profileVersion:
      data?.languageContext?.profileVersion === 1 || data?.languageContext?.profileVersion === 2
        ? data.languageContext.profileVersion
        : 2,
  };
}

export async function createBridgeSession(input: {
  studio: "academic" | "career" | "mirror";
  sourceLanguage: string;
  sourceInput: string;
  englishOutput: string;
  profileVersion: 1 | 2;
}): Promise<string> {
  const response = await fetch("/api/bridge-mode/sessions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      studio: input.studio,
      source_language: input.sourceLanguage,
      target_language: "en",
      source_input: input.sourceInput,
      english_output: input.englishOutput,
      profile_version: input.profileVersion,
    }),
  });

  const data = await response.json();
  if (!response.ok || typeof data?.id !== "string") {
    throw new Error(data?.error || "Failed to save Bridge session.");
  }

  void fetch(`/api/bridge-mode/sessions/${data.id}/reflect`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  }).catch(() => null);

  return data.id;
}
