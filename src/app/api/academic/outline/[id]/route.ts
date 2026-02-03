// src/app/api/academic/outline/[id]/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: fetchError } = await supabase
    .from("academic_outlines")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !data) {
    return NextResponse.json(
      { success: false, error: fetchError?.message || "Not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, outline: data }, { status: 200 });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (typeof body?.topic === "string") {
    updates.topic = body.topic.trim();
  }
  if (typeof body?.assignmentType === "string") {
    updates.assignment_type = body.assignmentType.trim();
  }
  if (typeof body?.className === "string") {
    updates.class_name = body.className.trim();
  }
  if (body?.outline) {
    updates.outline_structure = body.outline;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json(
      { success: false, error: "No updates provided." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error: updateError } = await supabase
    .from("academic_outlines")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json(
      { success: false, error: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error: deleteError } = await supabase
    .from("academic_outlines")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (deleteError) {
    return NextResponse.json(
      { success: false, error: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
