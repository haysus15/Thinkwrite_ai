// src/app/api/mirror-mode/settings/route.ts
// User preferences for live voice learning (NO CACHE + safer reads)

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";

export const runtime = "nodejs";

// 🚫 prevent Next/Vercel caching
export const dynamic = "force-dynamic";
export const revalidate = 0;

export type LiveLearningSettings = {
  enabled: boolean;
  sources: {
    coverLetters: boolean;
    lexChat: boolean;
    resumeUploads: boolean;
    resumeBuilder: boolean;
    tailoredResumes: boolean;
  };
  minimumWordCount: number;
  notifyOnLearning: boolean;
};

// Default settings for new users
const DEFAULT_SETTINGS: LiveLearningSettings = {
  enabled: true,
  sources: {
    coverLetters: true,
    lexChat: true,
    resumeUploads: true,
    resumeBuilder: true,
    tailoredResumes: true,
  },
  minimumWordCount: 30,
  notifyOnLearning: true,
};

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "Surrogate-Control": "no-store",
};

/**
 * GET /api/mirror-mode/settings
 * Retrieve user's live learning preferences
 */
export async function GET(req: NextRequest) {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401, headers: noStoreHeaders }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data: settings, error } = await supabase
      .from("mirror_mode_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // If table missing or row missing -> defaults
    if (error || !settings) {
      // If the table doesn't exist, don't treat as fatal
      if (error?.message?.includes("does not exist")) {
        return NextResponse.json(
          {
            success: true,
            settings: DEFAULT_SETTINGS,
            isDefault: true,
            message: "mirror_mode_settings table missing; using defaults",
          },
          { status: 200, headers: noStoreHeaders }
        );
      }

      return NextResponse.json(
        { success: true, settings: DEFAULT_SETTINGS, isDefault: true },
        { status: 200, headers: noStoreHeaders }
      );
    }

    // Normalize + fall back to defaults if partial/empty
    const normalized: LiveLearningSettings = {
      enabled: settings.live_learning_enabled ?? DEFAULT_SETTINGS.enabled,
      sources: {
        ...DEFAULT_SETTINGS.sources,
        ...(settings.learning_sources || {}),
      },
      minimumWordCount: settings.minimum_word_count ?? DEFAULT_SETTINGS.minimumWordCount,
      notifyOnLearning: settings.notify_on_learning ?? DEFAULT_SETTINGS.notifyOnLearning,
    };

    return NextResponse.json(
      { success: true, settings: normalized, isDefault: false },
      { status: 200, headers: noStoreHeaders }
    );
  } catch (error: any) {
    console.error("Settings fetch error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch settings" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

/**
 * POST /api/mirror-mode/settings
 * Update user's live learning preferences
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401, headers: noStoreHeaders }
      );
    }

    const supabase = await createSupabaseServerClient();
    const body = await req.json();
    const { settings } = body as {
      settings: Partial<LiveLearningSettings>;
    };

    // Merge with defaults (deep merge sources)
    const mergedSettings: LiveLearningSettings = {
      ...DEFAULT_SETTINGS,
      ...settings,
      sources: {
        ...DEFAULT_SETTINGS.sources,
        ...(settings?.sources || {}),
      },
      // Ensure numbers/booleans are sane
      minimumWordCount: Number.isFinite(settings?.minimumWordCount as any)
        ? Number(settings.minimumWordCount)
        : DEFAULT_SETTINGS.minimumWordCount,
      notifyOnLearning:
        typeof settings?.notifyOnLearning === "boolean"
          ? settings.notifyOnLearning
          : DEFAULT_SETTINGS.notifyOnLearning,
      enabled:
        typeof settings?.enabled === "boolean" ? settings.enabled : DEFAULT_SETTINGS.enabled,
    };

    const { error } = await supabase
      .from("mirror_mode_settings")
      .upsert(
        {
          user_id: userId,
          live_learning_enabled: mergedSettings.enabled,
          learning_sources: mergedSettings.sources,
          minimum_word_count: mergedSettings.minimumWordCount,
          notify_on_learning: mergedSettings.notifyOnLearning,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) {
      if (error.message.includes("does not exist")) {
        console.log("mirror_mode_settings table not found, using defaults");
        return NextResponse.json(
          {
            success: true,
            settings: mergedSettings,
            message: "Settings applied (table pending migration)",
          },
          { status: 200, headers: noStoreHeaders }
        );
      }
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: noStoreHeaders }
      );
    }

    return NextResponse.json(
      { success: true, settings: mergedSettings, message: "Settings updated successfully" },
      { status: 200, headers: noStoreHeaders }
    );
  } catch (error: any) {
    console.error("Settings update error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update settings" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
