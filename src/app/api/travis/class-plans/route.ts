import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const VALID_WEEKDAYS = new Set([
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]);

const VALID_CADENCE = new Set(["weekly", "custom"]);

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
    .from("travis_class_plans")
    .select("id, class_name, cadence, due_weekday, notes, updated_at")
    .eq("user_id", userId)
    .order("class_name", { ascending: true });

  if (fetchError) {
    return NextResponse.json(
      { success: false, error: fetchError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, plans: data || [] }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const className =
    typeof body?.class_name === "string" ? body.class_name.trim() : "";
  const cadence =
    typeof body?.cadence === "string" ? body.cadence.trim() : "";
  const dueWeekday =
    typeof body?.due_weekday === "string" ? body.due_weekday.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

  if (!className) {
    return NextResponse.json(
      { success: false, error: "Class name is required." },
      { status: 400 }
    );
  }

  if (!VALID_CADENCE.has(cadence)) {
    return NextResponse.json(
      { success: false, error: "Cadence must be weekly or custom." },
      { status: 400 }
    );
  }

  if (!VALID_WEEKDAYS.has(dueWeekday)) {
    return NextResponse.json(
      { success: false, error: "Due weekday is invalid." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("travis_class_plans")
    .select("id")
    .eq("user_id", userId)
    .ilike("class_name", className)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { success: false, error: existingError.message },
      { status: 500 }
    );
  }

  if (existing?.id) {
    const { data: updated, error: updateError } = await supabase
      .from("travis_class_plans")
      .update({
        class_name: className,
        cadence,
        due_weekday: dueWeekday,
        notes,
      })
      .eq("id", existing.id)
      .eq("user_id", userId)
      .select("id, class_name, cadence, due_weekday, notes, updated_at")
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { success: false, error: updateError?.message || "Failed to save plan." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, plan: updated }, { status: 200 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("travis_class_plans")
    .insert({
      user_id: userId,
      class_name: className,
      cadence,
      due_weekday: dueWeekday,
      notes,
    })
    .select("id, class_name, cadence, due_weekday, notes, updated_at")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { success: false, error: insertError?.message || "Failed to save plan." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, plan: inserted }, { status: 200 });
}

export async function DELETE(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const className =
    typeof body?.class_name === "string" ? body.class_name.trim() : "";

  if (!className) {
    return NextResponse.json(
      { success: false, error: "Class name is required." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error: deleteError } = await supabase
    .from("travis_class_plans")
    .delete()
    .eq("user_id", userId)
    .ilike("class_name", className);

  if (deleteError) {
    return NextResponse.json(
      { success: false, error: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
