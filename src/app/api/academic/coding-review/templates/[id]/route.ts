import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const templateId = context.params.id;
  const supabase = await createSupabaseServerClient();

  const { data, error: fetchError } = await supabase
    .schema("coding_review")
    .from("templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (fetchError || !data) {
    return NextResponse.json(
      { success: false, error: fetchError?.message || "Template not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, template: data }, { status: 200 });
}
