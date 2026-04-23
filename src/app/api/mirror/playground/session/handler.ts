import { NextRequest, NextResponse } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";

type SessionDeps = {
  resolveUserId: (request: NextRequest) => Promise<string | null>;
  createSupabaseServerClient: () => Promise<SupabaseClient> | SupabaseClient;
};

type CreateSessionBody = {
  conversation_onboarding?: boolean;
};

export async function handleCreatePlaygroundSession(request: NextRequest, deps: SessionDeps) {
  const userId = await deps.resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as CreateSessionBody | null;
  const supabase = await deps.createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("mirror_playground_sessions")
    .insert({
      user_id: userId,
      messages: [],
      context_memory: {},
      feedback_signals: [],
      conversation_onboarding: body?.conversation_onboarding === true,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return NextResponse.json(
      { error: error?.message || "Failed to create playground session" },
      { status: 500 }
    );
  }

  return NextResponse.json({ session_id: data.id }, { status: 200 });
}
