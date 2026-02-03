// src/app/api/travis/assignment/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const assignmentName = body?.assignment_name;
  const className = body?.class_name;

  if (!assignmentName || !className) {
    return NextResponse.json(
      { success: false, error: "Assignment name and class are required." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: insertError } = await supabase
    .from("assignments")
    .insert({
      user_id: userId,
      syllabus_id: body?.syllabus_id || null,
      class_name: className,
      assignment_name: assignmentName,
      assignment_type: body?.assignment_type || null,
      due_date: body?.due_date || null,
      requirements: body?.requirements || null,
      grading_weight: body?.grading_weight || null,
      notes: body?.notes || null,
      completed: body?.completed || false,
    })
    .select("id")
    .single();

  if (insertError || !data) {
    return NextResponse.json(
      { success: false, error: insertError?.message || "Create failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, id: data.id }, { status: 200 });
}
