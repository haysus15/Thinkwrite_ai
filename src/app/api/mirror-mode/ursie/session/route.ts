// src/app/api/mirror-mode/ursie/session/route.ts
// Manage Ursie sessions (new + save)

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

export async function POST() {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401, headers: noStoreHeaders }
      );
    }

    const supabase = await createSupabaseServerClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("mirror_mode_ursie_sessions")
      .insert({
        user_id: userId,
        created_at: now,
        updated_at: now,
        last_message_at: now,
        is_saved: false,
      })
      .select()
      .single();

    if (error && !error.message?.includes("does not exist")) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: noStoreHeaders }
      );
    }

    return NextResponse.json(
      { success: true, sessionId: data?.id },
      { status: 200, headers: noStoreHeaders }
    );
  } catch (error: any) {
    console.error("Ursie session create error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to create session" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401, headers: noStoreHeaders }
      );
    }

    const body = await req.json();
    const { sessionId, isSaved } = body as { sessionId?: string; isSaved?: boolean };

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "sessionId required" },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const supabase = await createSupabaseServerClient();

    if (isSaved) {
      const { count } = await supabase
        .from("mirror_mode_ursie_sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_saved", true);

      if ((count || 0) >= 10) {
        return NextResponse.json(
          { success: false, error: "You can only save up to 10 chats. Unsave one to continue." },
          { status: 400, headers: noStoreHeaders }
        );
      }
    }

    const { error } = await supabase
      .from("mirror_mode_ursie_sessions")
      .update({ is_saved: !!isSaved, updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("user_id", userId);

    if (error && !error.message?.includes("does not exist")) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: noStoreHeaders }
      );
    }

    return NextResponse.json(
      { success: true, isSaved: !!isSaved },
      { status: 200, headers: noStoreHeaders }
    );
  } catch (error: any) {
    console.error("Ursie session update error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update session" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
