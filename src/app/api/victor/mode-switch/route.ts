// src/app/api/victor/mode-switch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { VictorMode } from "@/types/academic-studio";

type PersistedVictorMode = VictorMode;

function toPersistedMode(mode: VictorMode): PersistedVictorMode {
  return mode;
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
  const conversationId = body?.conversationId as string;
  const toMode = body?.toMode as VictorMode;
  const persistedToMode = toPersistedMode(toMode);

  if (!conversationId || !toMode) {
    return NextResponse.json(
      { success: false, error: "Conversation and mode are required." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: fetchError } = await supabase
    .from("victor_conversations")
    .select("mode")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !data) {
    return NextResponse.json(
      { success: false, error: "Conversation not found." },
      { status: 404 }
    );
  }

  const fromMode = data.mode as VictorMode;
  const { error: updateError } = await supabase
    .from("victor_conversations")
    .update({ mode: persistedToMode })
    .eq("id", conversationId)
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json(
      { success: false, error: updateError.message },
      { status: 500 }
    );
  }

  await supabase.from("mode_transitions").insert({
    conversation_id: conversationId,
    from_mode: toPersistedMode(fromMode),
    to_mode: persistedToMode,
    trigger: "manual",
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
