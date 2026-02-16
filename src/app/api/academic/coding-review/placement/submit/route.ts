import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const pathId = typeof body?.path_id === "string" ? body.path_id : "";
  const responseEntry = body?.response;
  const assessedLevel =
    typeof body?.assessed_level === "number" ? body.assessed_level : null;
  const victorReasoning =
    typeof body?.victor_reasoning === "string" ? body.victor_reasoning : null;

  if (!pathId || !responseEntry) {
    return NextResponse.json(
      { success: false, error: "path_id and response are required." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: placement, error: placementError } = await supabase
    .schema("coding_review")
    .from("placements")
    .select("*")
    .eq("user_id", userId)
    .eq("path_id", pathId)
    .single();

  if (placementError || !placement) {
    return NextResponse.json(
      { success: false, error: placementError?.message || "Placement not found." },
      { status: 404 }
    );
  }

  const responses = Array.isArray(placement.student_responses)
    ? placement.student_responses
    : [];
  const nextResponses = [...responses, responseEntry];

  const { data: updated, error: updateError } = await supabase
    .schema("coding_review")
    .from("placements")
    .update({
      student_responses: nextResponses,
      assessed_level: assessedLevel ?? placement.assessed_level,
      victor_reasoning: victorReasoning ?? placement.victor_reasoning,
    })
    .eq("user_id", userId)
    .eq("path_id", pathId)
    .select("*")
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { success: false, error: updateError?.message || "Submit failed." },
      { status: 500 }
    );
  }

  if (assessedLevel !== null) {
    await supabase
      .schema("coding_review")
      .from("path_progress")
      .update({
        placement_level: assessedLevel,
        placement_data: {
          assessed_level: assessedLevel,
          responses: nextResponses,
        },
        last_active_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("path_id", pathId);
  }

  return NextResponse.json(
    { success: true, placement: updated },
    { status: 200 }
  );
}
