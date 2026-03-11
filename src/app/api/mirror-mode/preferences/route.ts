import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";

type RoadmapDismissedByChamber = {
  career: boolean;
  academic: boolean;
  creative: boolean;
  general: boolean;
};

const defaultRoadmapDismissed: RoadmapDismissedByChamber = {
  career: false,
  academic: false,
  creative: false,
  general: false,
};

function sanitizeRoadmapMap(value: unknown): RoadmapDismissedByChamber {
  if (!value || typeof value !== "object") return defaultRoadmapDismissed;
  const record = value as Record<string, unknown>;
  return {
    career: record.career === true,
    academic: record.academic === true,
    creative: record.creative === true,
    general: record.general === true,
  };
}

export async function GET() {
  const { userId, error: authError } = await getAuthUser();
  if (authError || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "mirror_mode_first_visit, quickstart_samples_count, mirror_roadmap_dismissed"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      preferences: {
        isFirstMirrorModeVisit: data?.mirror_mode_first_visit !== false,
        quickstartSamplesCount: data?.quickstart_samples_count || 0,
        roadmapDismissedByChamber: sanitizeRoadmapMap(data?.mirror_roadmap_dismissed),
      },
    },
    { status: 200 }
  );
}

export async function PATCH(request: NextRequest) {
  const { userId, error: authError } = await getAuthUser();
  if (authError || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const chamber = body?.roadmapDismissedChamber as
    | keyof RoadmapDismissedByChamber
    | undefined;
  const mirrorModeFirstVisit = body?.mirrorModeFirstVisit as boolean | undefined;
  const quickstartIncrement = Number(body?.quickstartIncrement || 0);

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("user_profiles")
    .select("mirror_roadmap_dismissed, quickstart_samples_count")
    .eq("user_id", userId)
    .maybeSingle();

  const roadmapDismissedByChamber = sanitizeRoadmapMap(
    existing?.mirror_roadmap_dismissed
  );
  if (chamber) {
    roadmapDismissedByChamber[chamber] = true;
  }

  const nextQuickstartCount =
    (existing?.quickstart_samples_count || 0) +
    (Number.isFinite(quickstartIncrement) ? quickstartIncrement : 0);

  const payload: Record<string, unknown> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
    mirror_roadmap_dismissed: roadmapDismissedByChamber,
  };
  if (typeof mirrorModeFirstVisit === "boolean") {
    payload.mirror_mode_first_visit = mirrorModeFirstVisit;
  }
  if (quickstartIncrement !== 0) {
    payload.quickstart_samples_count = Math.max(0, nextQuickstartCount);
  }

  const { error } = await supabase.from("user_profiles").upsert(payload, {
    onConflict: "user_id",
  });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
