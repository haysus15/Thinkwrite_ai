import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SUPPORTED_LANGUAGE_CODE_SET } from "@/lib/language/constants";
import { resolveDocumentLanguage } from "@/lib/language/profile";
import { aggregateLanguageProfile } from "@/lib/mirror/aggregateLanguageProfile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser();
  if (auth.error || !auth.userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const language = String(body?.language || "").trim().toLowerCase();
  if (!SUPPORTED_LANGUAGE_CODE_SET.has(language)) {
    return NextResponse.json(
      { success: false, error: "Unsupported language code" },
      { status: 400 }
    );
  }

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: document, error: loadError } = await supabase
    .from("mirror_documents")
    .select("id, user_id, language, language_override")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .single();

  if (loadError || !document) {
    return NextResponse.json(
      { success: false, error: "Document not found" },
      { status: 404 }
    );
  }

  const previousLanguage = resolveDocumentLanguage(document);
  const { data: updated, error: updateError } = await supabase
    .from("mirror_documents")
    .update({ language_override: language })
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select("*")
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { success: false, error: updateError?.message || "Failed to update document language" },
      { status: 500 }
    );
  }

  try {
    if (previousLanguage && previousLanguage !== "und") {
      await aggregateLanguageProfile(auth.userId, previousLanguage);
    }
    await aggregateLanguageProfile(auth.userId, language);
  } catch (aggregationError) {
    console.warn("[Mirror language override] aggregation skipped:", aggregationError);
  }

  return NextResponse.json({
    success: true,
    document: updated,
  });
}
