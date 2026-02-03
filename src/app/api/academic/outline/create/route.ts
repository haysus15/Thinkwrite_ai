// src/app/api/academic/outline/create/route.ts
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
  const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
  const assignmentType =
    typeof body?.assignmentType === "string" ? body.assignmentType.trim() : "";
  const className =
    typeof body?.className === "string" ? body.className.trim() : "";
  const outline = body?.outline;

  if (!topic || !outline?.thesis) {
    return NextResponse.json(
      { success: false, error: "Topic and thesis are required." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: insertError } = await supabase
    .from("academic_outlines")
    .insert({
      user_id: userId,
      topic,
      assignment_type: assignmentType,
      class_name: className,
      outline_structure: outline,
      conversation_history: [],
    })
    .select("id")
    .single();

  if (insertError || !data) {
    return NextResponse.json(
      { success: false, error: insertError?.message || "Save failed." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, outlineId: data.id },
    { status: 200 }
  );
}
