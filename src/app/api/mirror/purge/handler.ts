import { NextRequest, NextResponse } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getWritingTypeForChamber,
  isChamber,
  rebuildVoiceChambersFromDocuments,
} from "@/lib/mirror-core/classification";

type PurgeScope = "all" | "career" | "academic" | "creative" | "general";

function isScope(value: string | null | undefined): value is PurgeScope {
  return value === "all" || isChamber(value);
}

type PurgeDeps = {
  resolveUserId: (request: NextRequest) => Promise<string | null>;
  createSupabase: () => SupabaseClient | Promise<SupabaseClient>;
};

export async function handleMirrorPurgePost(request: NextRequest, deps: PurgeDeps) {
  const userId = await deps.resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await deps.createSupabase();
  const body = await request.json().catch(() => ({}));
  const scope = body?.scope;
  const confirmation = body?.confirmation;

  if (!isScope(scope)) {
    return NextResponse.json({ error: "Invalid purge scope" }, { status: 400 });
  }

  if (confirmation !== "DELETE") {
    return NextResponse.json(
      { error: "Confirmation required. Type DELETE to continue." },
      { status: 400 }
    );
  }

  if (scope === "all") {
    const { data: allDocs } = await supabase
      .from("mirror_documents")
      .select("id")
      .eq("user_id", userId);

    const docIds = (allDocs || []).map((doc) => doc.id);
    if (docIds.length > 0) {
      await supabase.from("mirror_document_content").delete().in("document_id", docIds);
    }

    await supabase.from("mirror_documents").delete().eq("user_id", userId);
    await supabase.from("mirror_unclassified_queue").delete().eq("user_id", userId);
    await supabase.from("voice_chambers").delete().eq("user_id", userId);

    return NextResponse.json({ success: true, purged: true, scope });
  }

  const writingType = getWritingTypeForChamber(scope);
  const { data: docs } = await supabase
    .from("mirror_documents")
    .select("id")
    .eq("user_id", userId)
    .eq("writing_type", writingType);

  const docIds = (docs || []).map((doc) => doc.id);
  if (docIds.length > 0) {
    await supabase.from("mirror_document_content").delete().in("document_id", docIds);
    await supabase.from("mirror_documents").delete().in("id", docIds).eq("user_id", userId);
  }

  if (scope === "general") {
    await supabase
      .from("mirror_unclassified_queue")
      .delete()
      .eq("user_id", userId);
  } else {
    await supabase
      .from("mirror_unclassified_queue")
      .delete()
      .eq("user_id", userId)
      .eq("assigned_chamber", scope);
  }

  await rebuildVoiceChambersFromDocuments(supabase, userId);

  return NextResponse.json({ success: true, purged: true, scope });
}
