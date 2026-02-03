import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { userId, error: authError } = await getAuthUser();
  if (authError || !userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: feedback } = await supabase
    .from("voice_feedback")
    .select("action, content_type")
    .eq("user_id", userId);

  if (!feedback) {
    return NextResponse.json({
      success: true,
      stats: { total: 0, accepted: 0, edited: 0, rejected: 0, acceptanceRate: 0 },
    });
  }

  const total = feedback.length;
  const accepted = feedback.filter((f) => f.action === "accepted").length;
  const edited = feedback.filter((f) => f.action === "edited").length;
  const rejected = feedback.filter((f) => f.action === "rejected").length;
  const acceptanceRate =
    total > 0 ? Math.round(((accepted + edited * 0.5) / total) * 100) : 0;

  const byContentType: Record<
    string,
    { accepted: number; edited: number; rejected: number }
  > = {};

  for (const f of feedback) {
    if (!byContentType[f.content_type]) {
      byContentType[f.content_type] = { accepted: 0, edited: 0, rejected: 0 };
    }
    byContentType[f.content_type][
      f.action as "accepted" | "edited" | "rejected"
    ]++;
  }

  return NextResponse.json({
    success: true,
    stats: {
      total,
      accepted,
      edited,
      rejected,
      acceptanceRate,
      byContentType,
    },
  });
}
