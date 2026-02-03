// src/app/api/mirror-mode/ursie/memory/route.ts
// Save explicit memory notes for Ursie

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
    const { sessionId, note } = body as { sessionId?: string; note?: string };

    if (!note || !note.trim()) {
      return NextResponse.json(
        { success: false, error: "Memory note required" },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("mirror_mode_ursie_memories")
      .insert({
        user_id: userId,
        session_id: sessionId || null,
        note: note.trim(),
        created_at: new Date().toISOString(),
      });

    if (error && !error.message?.includes("does not exist")) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: noStoreHeaders }
      );
    }

    return NextResponse.json(
      { success: true, message: "Memory saved" },
      { status: 200, headers: noStoreHeaders }
    );
  } catch (error: any) {
    console.error("Ursie memory save error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to save memory" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
