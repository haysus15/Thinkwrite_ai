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

  const { data: placement, error: placementError } = await supabase
    .schema("coding_review")
    .from("placements")
    .upsert(
      {
        user_id: userId,
        path_id: pathId,
        challenges_presented: challenges,
        student_responses: [],
        assessed_level: null,
        victor_reasoning: null,
      },
      { onConflict: "user_id,path_id" }
    )
    .select("*")
    .single();

  if (placementError || !placement) {
    return NextResponse.json(
      { success: false, error: placementError?.message || "Placement failed." },
      { status: 500 }
    );
  }

  const { error: progressError } = await supabase
    .schema("coding_review")
    .from("path_progress")
    .upsert(
      {
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
      },
      { onConflict: "user_id,path_id" }
    );

  if (progressError) {
    return NextResponse.json(
      { success: false, error: progressError.message || "Progress failed." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      placement,
      challenges,
    },
    { status: 200 }
  );
}
