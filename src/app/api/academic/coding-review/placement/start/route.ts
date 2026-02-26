import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PATH_CHALLENGES: Record<string, string[]> = {
  intro_python: [
    "Write a line that prints your name.",
    "Write a function that takes two numbers and returns the larger one.",
    "Write a function that takes a list of numbers and returns a new list with only the even numbers.",
  ],
  sql_fundamentals: [
    "Select all columns from the students table.",
    "Find students with a GPA above 3.5.",
    "Show average GPA by major.",
  ],
  js_essentials: [
    "Log your name to the console.",
    "Write a function that returns the square of a number.",
    "Create an array of numbers and log only numbers greater than 10.",
  ],
};

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
  if (!PATH_CHALLENGES[pathId]) {
    return NextResponse.json(
      { success: false, error: "Invalid path_id." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const challenges = PATH_CHALLENGES[pathId];

  const { data: existingPlacement, error: existingPlacementError } = await supabase
    .schema("coding_review")
    .from("placements")
    .select("*")
    .eq("user_id", userId)
    .eq("path_id", pathId)
    .maybeSingle();

  if (existingPlacementError) {
    return NextResponse.json(
      {
        success: false,
        error: existingPlacementError.message || "Failed to load placement.",
      },
      { status: 500 }
    );
  }

  let placement = existingPlacement;
  if (!existingPlacement) {
    const { data: createdPlacement, error: createPlacementError } = await supabase
      .schema("coding_review")
      .from("placements")
      .insert({
        user_id: userId,
        path_id: pathId,
        challenges_presented: challenges,
        student_responses: [],
        assessed_level: null,
        victor_reasoning: null,
      })
      .select("*")
      .single();

    if (createPlacementError || !createdPlacement) {
      return NextResponse.json(
        {
          success: false,
          error: createPlacementError?.message || "Placement failed.",
        },
        { status: 500 }
      );
    }
    placement = createdPlacement;
  } else if (
    !Array.isArray(existingPlacement.challenges_presented) ||
    existingPlacement.challenges_presented.length === 0
  ) {
    const { data: refreshedPlacement, error: refreshPlacementError } = await supabase
      .schema("coding_review")
      .from("placements")
      .update({ challenges_presented: challenges })
      .eq("user_id", userId)
      .eq("path_id", pathId)
      .select("*")
      .single();

    if (refreshPlacementError || !refreshedPlacement) {
      return NextResponse.json(
        {
          success: false,
          error: refreshPlacementError?.message || "Placement failed.",
        },
        { status: 500 }
      );
    }
    placement = refreshedPlacement;
  }

  const { data: existingProgress, error: progressFetchError } = await supabase
    .schema("coding_review")
    .from("path_progress")
    .select("id")
    .eq("user_id", userId)
    .eq("path_id", pathId)
    .maybeSingle();

  if (progressFetchError) {
    return NextResponse.json(
      { success: false, error: progressFetchError.message || "Progress failed." },
      { status: 500 }
    );
  }

  if (!existingProgress) {
    const { error: progressInsertError } = await supabase
      .schema("coding_review")
      .from("path_progress")
      .insert({
        user_id: userId,
        path_id: pathId,
        current_lesson: 0,
        lessons_completed: [],
        placement_level: null,
        placement_data: null,
        checkpoint_results: [],
        total_time_seconds: 0,
        struggle_topics: [],
        started_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
      });

    if (progressInsertError) {
      return NextResponse.json(
        { success: false, error: progressInsertError.message || "Progress failed." },
        { status: 500 }
      );
    }
  } else {
    await supabase
      .schema("coding_review")
      .from("path_progress")
      .update({ last_active_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("path_id", pathId);
  }

  return NextResponse.json(
    {
      success: true,
      placement,
      challenges:
        Array.isArray(placement?.challenges_presented) &&
        placement.challenges_presented.length > 0
          ? placement.challenges_presented
          : challenges,
      placementRequired:
        typeof placement?.assessed_level !== "number" &&
        (Array.isArray(placement?.student_responses)
          ? placement.student_responses.length
          : 0) <
          (
            Array.isArray(placement?.challenges_presented) &&
            placement.challenges_presented.length > 0
              ? placement.challenges_presented
              : challenges
          ).length,
      nextChallengeIndex: Math.min(
        Array.isArray(placement?.student_responses)
          ? placement.student_responses.length
          : 0,
        Math.max(
          0,
          (
            Array.isArray(placement?.challenges_presented) &&
            placement.challenges_presented.length > 0
              ? placement.challenges_presented
              : challenges
          ).length - 1
        )
      ),
    },
    { status: 200 }
  );
}
