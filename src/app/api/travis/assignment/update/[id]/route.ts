// src/app/api/travis/assignment/update/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function diffFields(current: Record<string, any>, next: Record<string, any>) {
  const changes: Array<{ field: string; oldValue: string; newValue: string }> =
    [];
  Object.entries(next).forEach(([field, value]) => {
    if (value === undefined) return;
    const currentValue = current[field];
    const oldString = JSON.stringify(currentValue ?? null);
    const newString = JSON.stringify(value ?? null);
    if (oldString !== newString) {
      changes.push({
        field,
        oldValue: oldString,
        newValue: newString,
      });
    }
  });
  return changes;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const reason = body?.reason || null;

  const supabase = await createSupabaseServerClient();
  const { data: current, error: fetchError } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !current) {
    return NextResponse.json(
      { success: false, error: "Assignment not found." },
      { status: 404 }
    );
  }

  const updates: Record<string, any> = {
    class_name: body?.class_name,
    assignment_name: body?.assignment_name,
    assignment_type: body?.assignment_type,
    due_date: body?.due_date,
    requirements: body?.requirements,
    grading_weight: body?.grading_weight,
    notes: body?.notes,
    completed: body?.completed,
    updated_at: new Date().toISOString(),
  };

  const changes = diffFields(current, updates);
  const { error: updateError } = await supabase
    .from("assignments")
    .update(updates)
    .eq("id", params.id)
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json(
      { success: false, error: updateError.message },
      { status: 500 }
    );
  }

  if (changes.length > 0) {
    await supabase.from("assignment_overrides").insert(
      changes.map((change) => ({
        assignment_id: params.id,
        user_id: userId,
        field_changed: change.field,
        old_value: change.oldValue,
        new_value: change.newValue,
        reason,
      }))
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
