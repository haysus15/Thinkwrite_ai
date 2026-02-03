// src/app/api/study/materials/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: fetchError } = await supabase
    .from("study_materials")
    .select("id, title, class_name, topic, source_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (fetchError) {
    return NextResponse.json(
      { success: false, error: fetchError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, materials: data }, { status: 200 });
}
