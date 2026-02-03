// src/app/api/travis/syllabus/[id]/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: fetchError } = await supabase
    .from("syllabi")
    .select("id, class_name, parsed_data, confirmed, uploaded_at")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !data) {
    return NextResponse.json(
      { success: false, error: "Syllabus not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, syllabus: data }, { status: 200 });
}
