// src/app/api/travis/syllabus/confirm/[id]/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
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
  const { data: syllabus, error: fetchError } = await supabase
    .from("syllabi")
    .select("id, class_name, parsed_data, confirmed")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !syllabus) {
    return NextResponse.json(
      { success: false, error: "Syllabus not found." },
      { status: 404 }
    );
  }

  if (syllabus.confirmed) {
    return NextResponse.json({ success: true }, { status: 200 });
  }

  const assignments = syllabus.parsed_data?.assignments || [];
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return NextResponse.json(
      { success: false, error: "No assignments to confirm." },
      { status: 400 }
    );
  }

  const inserts = assignments.map((assignment: any) => ({
    user_id: userId,
    syllabus_id: syllabus.id,
    class_name: syllabus.class_name,
    assignment_name: assignment.name,
    assignment_type: assignment.type,
    due_date: assignment.due_date ? new Date(assignment.due_date).toISOString() : null,
    requirements: assignment.requirements || null,
    grading_weight: assignment.grading_weight || null,
    completed: false,
  }));

  const { error: insertError } = await supabase
    .from("assignments")
    .insert(inserts);

  if (insertError) {
    return NextResponse.json(
      { success: false, error: insertError.message },
      { status: 500 }
    );
  }

  const { error: updateError } = await supabase
    .from("syllabi")
    .update({ confirmed: true })
    .eq("id", params.id)
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json(
      { success: false, error: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, assignmentsCreated: inserts.length },
    { status: 200 }
  );
}
