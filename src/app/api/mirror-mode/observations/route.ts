// src/app/api/mirror-mode/observations/route.ts
// Get Ursie's observations for Mirror Mode

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "Surrogate-Control": "no-store",
};

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
    const { searchParams } = new URL(req.url);
    const limitRaw = searchParams.get("limit") || "6";
    const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 6, 1), 20);

    const { data, error } = await supabase
      .from("ursie_observations")
      .select("id, observation_type, chamber, observation_text, generated_at")
      .eq("user_id", userId)
      .eq("dismissed", false)
      .order("generated_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers: noStoreHeaders }
      );
    }

    return NextResponse.json(
      { success: true, observations: data || [] },
      { status: 200, headers: noStoreHeaders }
    );
  } catch (error: any) {
    console.error("Observations fetch error:", error?.message);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
