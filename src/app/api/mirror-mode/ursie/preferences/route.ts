// src/app/api/mirror-mode/ursie/preferences/route.ts
// Ursie user preferences (memory prompt)

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "Surrogate-Control": "no-store",
};

export async function GET() {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401, headers: noStoreHeaders }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("mirror_mode_ursie_preferences")
      .select("memory_prompt_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (error && !error.message?.includes("does not exist")) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: noStoreHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        memoryPromptEnabled:
          typeof data?.memory_prompt_enabled === "boolean"
            ? data.memory_prompt_enabled
            : true,
      },
      { status: 200, headers: noStoreHeaders }
    );
  } catch (error: any) {
    console.error("Ursie prefs GET error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load preferences" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401, headers: noStoreHeaders }
      );
    }

    const body = await req.json();
    const { memoryPromptEnabled } = body as { memoryPromptEnabled?: boolean };

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("mirror_mode_ursie_preferences")
      .upsert(
        {
          user_id: userId,
          memory_prompt_enabled: typeof memoryPromptEnabled === "boolean" ? memoryPromptEnabled : true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error && !error.message?.includes("does not exist")) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: noStoreHeaders }
      );
    }

    return NextResponse.json(
      { success: true, memoryPromptEnabled: typeof memoryPromptEnabled === "boolean" ? memoryPromptEnabled : true },
      { status: 200, headers: noStoreHeaders }
    );
  } catch (error: any) {
    console.error("Ursie prefs POST error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update preferences" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
