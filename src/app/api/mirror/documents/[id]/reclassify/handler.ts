import { NextRequest, NextResponse } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getWritingTypeForChamber,
  isChamber,
  rebuildVoiceChambersFromDocuments,
} from "@/lib/mirror-core/classification";

type ReclassifyBody = {
  new_chamber: string;
};

type ReclassifyDeps = {
  resolveUserId: (request: NextRequest) => Promise<string | null>;
  createSupabaseAdmin: () => SupabaseClient;
};

export async function handleReclassifyDocument(
  request: NextRequest,
  params: { id: string },
  deps: ReclassifyDeps
) {
  const userId = await deps.resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ReclassifyBody | null;
  if (!body || !isChamber(body.new_chamber)) {
    return NextResponse.json(
      { error: "Invalid reclassification payload" },
      { status: 400 }
    );
  }

  const supabase = deps.createSupabaseAdmin();
  const { data: document, error: documentError } = await supabase
    .from("mirror_documents")
    .select("id, user_id, writing_type")
    .eq("id", params.id)
    .maybeSingle();

  if (documentError) {
    return NextResponse.json({ error: documentError.message }, { status: 500 });
  }

  if (!document?.id || document.user_id !== userId) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const nextWritingType = getWritingTypeForChamber(body.new_chamber);
  const { error: updateError } = await supabase
    .from("mirror_documents")
    .update({
      writing_type: nextWritingType,
      updated_at: new Date().toISOString(),
    })
    .eq("id", document.id)
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await rebuildVoiceChambersFromDocuments(supabase, userId);

  return NextResponse.json({
    success: true,
    documentId: document.id,
    newChamber: body.new_chamber,
  });
}
