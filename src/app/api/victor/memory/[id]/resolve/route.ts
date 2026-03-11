import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ success: false, error: "Memory id is required." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error: updateError } = await supabase
    .from("concept_struggles")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json(
      { success: false, error: updateError.message || "Failed to resolve Victor memory item." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
