// src/app/api/victor/conversations/saved/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    .from("victor_conversations")
    .select("id, title, mode, last_message_at")
    .eq("user_id", userId)
    .eq("saved", true)
    .order("last_message_at", { ascending: false })
    .limit(25);

  if (fetchError) {
    return NextResponse.json(
      { success: false, error: fetchError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, sessions: data || [] },
    { status: 200 }
  );
}
