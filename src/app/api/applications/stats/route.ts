// Application Stats API Route
// src/app/api/applications/stats/route.ts

import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseAdmin } from "@/lib/auth/getAuthUser";
import { Errors } from "@/lib/api/errors";

export const runtime = "nodejs";

function zeroStats(user_id: string) {
  return {
    user_id,
    saved_count: 0,
    applied_count: 0,
    response_count: 0,
    interview_count: 0,
    offer_count: 0,
    rejected_count: 0,
    withdrawn_count: 0,
    total_count: 0,
    avg_match_score: null,
    avg_mock_score: null,
  };
}

export async function GET(req: Request) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();

    const { data, error } = await supabase
      .from("application_pipeline_stats")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ success: true, stats: zeroStats(userId) });
    }

    return NextResponse.json({ success: true, stats: data });
  } catch (e: any) {
    console.error("[Applications stats]:", e?.message);
    return Errors.internal();
  }
}
