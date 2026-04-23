"use client";

import { useAuth } from "@/contexts/AuthContext";

export interface BridgeModeContext {
  enabled: boolean;
  sourceLanguage: string;
  targetLanguage: string;
  isActive: boolean;
}

export function useBridgeMode(): BridgeModeContext {
  const { profile } = useAuth();

  const enabled = profile?.bridge_mode_enabled === true;
  const sourceLanguage =
    typeof profile?.bridge_mode_source_language === "string"
      ? profile.bridge_mode_source_language
      : "";
  const targetLanguage =
    typeof profile?.bridge_mode_target_language === "string"
      ? profile.bridge_mode_target_language
      : "en";

  if (!enabled) {
    return {
      enabled: false,
      sourceLanguage: "",
      targetLanguage: "en",
      isActive: false,
    };
  }

  return {
    enabled,
    sourceLanguage,
    targetLanguage,
    isActive: true,
  };
}
