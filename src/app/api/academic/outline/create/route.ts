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
  const assignmentId =
    typeof body?.assignmentId === "string" ? body.assignmentId.trim() : "";
  const outline = body?.outline;
  const studentDeclaration =
    body?.studentDeclaration && typeof body.studentDeclaration === "object"
      ? body.studentDeclaration
      : null;
  const sectionConfidence =
    body?.sectionConfidence && typeof body.sectionConfidence === "object"
      ? body.sectionConfidence
      : null;
  const sourceRequirements =
    body?.sourceRequirements && typeof body.sourceRequirements === "object"
      ? body.sourceRequirements
      : null;
  const conversationHistory = Array.isArray(body?.conversationHistory)
    ? body.conversationHistory
    : [];

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
      assignment_id: assignmentId || null,
      outline_structure: outline,
      conversation_history: conversationHistory,
      student_declaration: studentDeclaration,
      section_confidence: sectionConfidence,
      source_requirements: sourceRequirements,
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
