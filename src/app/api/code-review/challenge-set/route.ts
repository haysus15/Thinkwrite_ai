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
    const includeSessions = url.searchParams.get("include") === "sessions";

    const supabase = await createSupabaseServerClient();
    const { data: sets, error } = await supabase
      .from("code_challenge_sets")
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
      return NextResponse.json({ error: "Challenge set not found." }, { status: 404 });
    }

    if (!includeSessions) {
      return NextResponse.json({ set: found });
    }

    const { data: sessions, error: sessionsError } = await supabase
      .schema("coding_review")
      .from("sessions")
      .select(
        "id, user_id, language, entry_type, challenge_set_id, set_order, assignment_id, code_snapshot, output_snapshot, victor_context, is_complete, completed_at, last_active_at, created_at, updated_at"
      )
      .eq("user_id", userId)
      .eq("challenge_set_id", setId)
      .order("set_order", { ascending: true });

    if (sessionsError) {
      return NextResponse.json({ error: sessionsError.message }, { status: 500 });
    }

    return NextResponse.json({ set: found, sessions: sessions || [] });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load challenge sets.",
      },
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
      class_name:
        typeof body?.class_name === "string" ? body.class_name.trim() || null : null,
      assignment_prompt:
        typeof body?.assignment_prompt === "string"
          ? body.assignment_prompt.trim() || null
          : null,
      language:
        typeof body?.language === "string" ? body.language.trim() || null : null,
      challenge_count:
        body?.challenge_count == null || Number.isNaN(Number(body.challenge_count))
          ? null
          : Number(body.challenge_count),
      source_type:
        body?.source_type === "paste" || body?.source_type === "upload"
          ? body.source_type
          : "manual",
      source_raw: typeof body?.source_raw === "string" ? body.source_raw : null,
      status: "in_progress",
      updated_at: new Date().toISOString(),
    };

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("code_challenge_sets")
      .insert(payload)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Unable to create challenge set." },
        { status: 500 }
      );
    }

    return NextResponse.json({ set: data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create challenge set.",
      },
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
    if (typeof body?.language === "string") updates.language = body.language.trim() || null;
    if (body?.challenge_count != null && !Number.isNaN(Number(body.challenge_count))) {
      updates.challenge_count = Number(body.challenge_count);
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
      .from("code_challenge_sets")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Unable to update challenge set." },
        { status: 500 }
      );
    }

    return NextResponse.json({ set: data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update challenge set.",
      },
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
      .schema("coding_review")
      .from("sessions")
      .update({ challenge_set_id: null, set_order: null })
      .eq("user_id", userId)
      .eq("challenge_set_id", id);

    const { error } = await supabase
      .from("code_challenge_sets")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete challenge set.",
      },
      { status: 500 }
    );
  }
}
