import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const setId = url.searchParams.get("id");
    const includePapers = url.searchParams.get("include") === "papers";

    const supabase = await createSupabaseServerClient();
    const { data: sets, error } = await supabase
      .from("paper_assignment_sets")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!setId) {
      return NextResponse.json({ sets: sets || [] });
    }

    const found = (sets || []).find((set) => String(set.id) === setId);
    if (!found) {
      return NextResponse.json({ error: "Assignment set not found." }, { status: 404 });
    }

    if (!includePapers) {
      return NextResponse.json({ set: found });
    }

    const { data: papers, error: papersError } = await supabase
      .from("academic_papers")
      .select(
        "id, topic, paper_content, word_count, is_complete, set_order, assignment_set_id, outline_id, workflow_step, created_at, updated_at, completed_at"
      )
      .eq("user_id", userId)
      .eq("assignment_set_id", setId)
      .order("set_order", { ascending: true });

    if (papersError) {
      return NextResponse.json({ error: papersError.message }, { status: 500 });
    }

    return NextResponse.json({ set: found, papers: papers || [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load assignment sets." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const payload = {
      user_id: userId,
      title,
      class_name: typeof body?.class_name === "string" ? body.class_name.trim() || null : null,
      assignment_prompt:
        typeof body?.assignment_prompt === "string" ? body.assignment_prompt.trim() || null : null,
      rubric_text: typeof body?.rubric_text === "string" ? body.rubric_text.trim() || null : null,
      paper_count:
        body?.paper_count == null || Number.isNaN(Number(body.paper_count))
          ? null
          : Number(body.paper_count),
      source_type:
        body?.source_type === "paste" || body?.source_type === "upload" ? body.source_type : "manual",
      source_raw: typeof body?.source_raw === "string" ? body.source_raw : null,
      status: "in_progress",
      updated_at: new Date().toISOString(),
    };

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("paper_assignment_sets")
      .insert(payload)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Unable to create assignment set." }, { status: 500 });
    }

    return NextResponse.json({ set: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create assignment set." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body?.title === "string") updates.title = body.title.trim();
    if (typeof body?.class_name === "string") updates.class_name = body.class_name.trim() || null;
    if (typeof body?.assignment_prompt === "string") {
      updates.assignment_prompt = body.assignment_prompt.trim() || null;
    }
    if (typeof body?.rubric_text === "string") updates.rubric_text = body.rubric_text.trim() || null;
    if (body?.paper_count != null && !Number.isNaN(Number(body.paper_count))) {
      updates.paper_count = Number(body.paper_count);
    }
    if (
      body?.status === "in_progress" ||
      body?.status === "completed" ||
      body?.status === "abandoned"
    ) {
      updates.status = body.status;
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("paper_assignment_sets")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Unable to update assignment set." }, { status: 500 });
    }

    return NextResponse.json({ set: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update assignment set." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    await supabase
      .from("academic_papers")
      .update({ assignment_set_id: null, set_order: null })
      .eq("user_id", userId)
      .eq("assignment_set_id", id);

    const { error } = await supabase
      .from("paper_assignment_sets")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete assignment set." },
      { status: 500 }
    );
  }
}
