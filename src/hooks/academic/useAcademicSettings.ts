"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  DEFAULT_ACADEMIC_SETTINGS,
  type AcademicSettings,
} from "@/components/academic/chat/chatTypes";

type UseAcademicSettingsResult = {
  settings: AcademicSettings;
  updateSetting: <K extends keyof AcademicSettings>(
    key: K,
    value: AcademicSettings[K]
  ) => Promise<void>;
  loading: boolean;
  preferredLanguage: string;
};

function mergeAcademicSettings(value: unknown): AcademicSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_ACADEMIC_SETTINGS;
  }

  const record = value as Partial<AcademicSettings>;
  return {
    sessionEntryPreference:
      record.sessionEntryPreference === "direct" ? "direct" : "chat_first",
    travisSessionMemory:
      typeof record.travisSessionMemory === "boolean"
        ? record.travisSessionMemory
        : DEFAULT_ACADEMIC_SETTINGS.travisSessionMemory,
    victorAvailability:
      record.victorAvailability === "always" ? "always" : "workflow_only",
  };
}

export function useAcademicSettings(
  userId: string | null | undefined
): UseAcademicSettingsResult {
  const [settings, setSettings] = useState<AcademicSettings>(DEFAULT_ACADEMIC_SETTINGS);
  const [loading, setLoading] = useState(Boolean(userId));
  const [preferredLanguage, setPreferredLanguage] = useState("en");

  useEffect(() => {
    if (!userId) {
      setSettings(DEFAULT_ACADEMIC_SETTINGS);
      setPreferredLanguage("en");
      setLoading(false);
      return;
    }

    let active = true;
    const supabase = createSupabaseBrowserClient();

    async function load() {
      setLoading(true);

      const [{ data: preferencesData }, { data: profileData }] = await Promise.all([
        supabase
          .from("user_preferences")
          .select("academic_settings")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("user_profiles")
          .select("preferred_language")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      if (!active) return;

      setSettings(mergeAcademicSettings(preferencesData?.academic_settings));
      setPreferredLanguage(profileData?.preferred_language || "en");
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [userId]);

  const updateSetting = useCallback(
    async <K extends keyof AcademicSettings>(key: K, value: AcademicSettings[K]) => {
      if (!userId) return;

      const nextSettings = {
        ...settings,
        [key]: value,
      };

      setSettings(nextSettings);

      const supabase = createSupabaseBrowserClient();
      const { data: existing, error: fetchError } = await supabase
        .from("user_preferences")
        .select("academic_settings")
        .eq("user_id", userId)
        .maybeSingle();

      if (fetchError && fetchError.code !== "PGRST116") {
        throw new Error(fetchError.message || "Could not load user preferences.");
      }

      const mergedSettings = mergeAcademicSettings({
        ...(existing?.academic_settings &&
        typeof existing.academic_settings === "object"
          ? existing.academic_settings
          : {}),
        [key]: value,
      });

      const { error: upsertError } = await supabase.from("user_preferences").upsert(
        {
          user_id: userId,
          academic_settings: mergedSettings,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );

      if (upsertError) {
        setSettings(settings);
        throw new Error(upsertError.message || "Could not save academic settings.");
      }
    },
    [settings, userId]
  );

  return {
    settings,
    updateSetting,
    loading,
    preferredLanguage,
  };
}
