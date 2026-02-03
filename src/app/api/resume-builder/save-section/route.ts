import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { userId, error: authError } = await getAuthUser();
  if (authError || !userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { draftId, sectionType, content } = await req.json();

  if (!draftId || !sectionType || !content) {
    return NextResponse.json(
      { success: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: draft } = await supabase
    .from("resume_drafts")
    .select("sections")
    .eq("id", draftId)
    .eq("user_id", userId)
    .single();

  if (!draft) {
    return NextResponse.json(
      { success: false, error: "Draft not found" },
      { status: 404 }
    );
  }

  const sections = draft.sections || {};
  sections[sectionType] = {
    content,
    status: "approved",
    approvedAt: new Date().toISOString(),
  };

  const sectionOrder = ["summary", "experience", "education", "skills", "projects"];
  const currentIndex = sectionOrder.indexOf(sectionType);
  const nextSection = sectionOrder[currentIndex + 1] || "review";

  await supabase
    .from("resume_drafts")
    .update({
      sections,
      current_section: nextSection,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId);

  return NextResponse.json({
    success: true,
    nextSection,
  });
}
