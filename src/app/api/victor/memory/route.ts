import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  logConceptStruggle,
  type StruggleType,
} from "@/lib/academic/victor/logConceptStruggle";

function isStruggleType(value: unknown): value is StruggleType {
  return (
    value === "misconception" ||
    value === "recall_gap" ||
    value === "reasoning_gap" ||
    value === "incomplete_understanding"
  );
}

export async function GET(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  const classNameFilter = request.nextUrl.searchParams.get("className")?.trim();
  const includeResolved = request.nextUrl.searchParams.get("includeResolved") === "true";

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("concept_struggles")
    .select(
      "id, assignment_id, class_name, concept, struggle_type, detected_at, resolved, resolved_at, session_notes"
    )
    .eq("user_id", userId)
    .order("detected_at", { ascending: false })
    .limit(200);

  if (classNameFilter) {
    query = query.eq("class_name", classNameFilter);
  }

  if (!includeResolved) {
    query = query.eq("resolved", false);
  }

  const { data, error: selectError } = await query;
  if (selectError) {
    return NextResponse.json(
      { success: false, error: selectError.message || "Failed to load Victor memory." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  const body = (await request.json()) as {
    assignmentId?: string | null;
    className?: string;
    struggleType?: string;
    sessionNotes?: string | null;
    studentMessages?: string[];
  };

  const className = typeof body.className === "string" ? body.className.trim() : "";
  if (!className) {
    return NextResponse.json(
      { success: false, error: "className is required." },
      { status: 400 }
    );
  }

  if (!isStruggleType(body.struggleType)) {
    return NextResponse.json(
      { success: false, error: "Invalid struggleType." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();

  try {
    await logConceptStruggle(supabase, {
      userId,
      assignmentId:
        typeof body.assignmentId === "string" && body.assignmentId ? body.assignmentId : null,
      className,
      struggleType: body.struggleType,
      sessionNotes: typeof body.sessionNotes === "string" ? body.sessionNotes : null,
      studentMessages: Array.isArray(body.studentMessages)
        ? body.studentMessages.map((value) => String(value ?? ""))
        : [],
    });

    return NextResponse.json({ success: true });
  } catch (insertError) {
    const message =
      insertError instanceof Error
        ? insertError.message
        : "Failed to log Victor memory item.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { error: deleteError } = await supabase
    .from("concept_struggles")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    return NextResponse.json(
      { success: false, error: deleteError.message || "Failed to clear Victor memory." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
