// src/app/api/victor/conversation/save/[id]/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function buildTitle(messages: Array<{ role: string; content: string }>) {
  const firstUser = messages.find((message) => message.role === "user");
  if (!firstUser?.content) return "Victor session";
  return firstUser.content.trim().slice(0, 60);
}

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
  const { data: savedCount } = await supabase
    .from("victor_conversations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("saved", true);

  if ((savedCount ?? 0) >= 25) {
    return NextResponse.json(
      {
        success: false,
        error: "You have reached the 25-session limit. Delete a session first.",
      },
      { status: 400 }
    );
  }

  const { data: conversation, error: fetchError } = await supabase
    .from("victor_conversations")
    .select("id, messages, title")
    .eq("id", params.id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !conversation) {
    return NextResponse.json(
      { success: false, error: "Conversation not found." },
      { status: 404 }
    );
  }

  const title = conversation.title || buildTitle(conversation.messages || []);
  const { error: updateError } = await supabase
    .from("victor_conversations")
    .update({ saved: true, title })
    .eq("id", params.id)
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json(
      { success: false, error: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, title }, { status: 200 });
}
