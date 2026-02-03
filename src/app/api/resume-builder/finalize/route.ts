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

  const { draftId, finalContent, transformedContent } = await req.json();

  if (!draftId || !finalContent) {
    return NextResponse.json(
      { success: false, error: "Missing draftId or finalContent" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("resume_drafts")
    .update({
      final_content: finalContent,
      final_transformed_content: transformedContent || null,
      status: "complete",
      finalized_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
