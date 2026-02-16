import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const language = request.nextUrl.searchParams.get("language");
  const supabase = await createSupabaseServerClient();

  const templatesQuery = supabase
    .schema("coding_review")
    .from("templates")
    .select("*")
    .order("title", { ascending: true });

  if (language) {
    templatesQuery.eq("language", language);
  }

  const { data, error: fetchError } = await templatesQuery;
  if (fetchError) {
    return NextResponse.json(
      {
        success: false,
        error: fetchError.message || "Fetch failed.",
        code: fetchError.code || null,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, templates: data || [] }, { status: 200 });
}
