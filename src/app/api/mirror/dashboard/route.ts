import { NextResponse } from "next/server.js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getConfidenceLabel } from "@/lib/mirror-core/voiceAggregation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHAMBERS = ["career", "academic", "creative", "general", "overall"] as const;

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: chamberRows, error: chamberError }, { count: queueCount, error: queueError }, { data: docs, error: docsError }, { data: extensionRows, error: extensionError }] =
    await Promise.all([
      supabase
        .from("voice_chambers")
        .select("chamber, confidence_level, document_count, total_word_count, last_trained_at, updated_at")
        .eq("user_id", user.id)
        .in("chamber", [...CHAMBERS]),
      supabase
        .from("mirror_unclassified_queue")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("reviewed", false),
      supabase
        .from("mirror_documents")
        .select("id, file_name, writing_type, word_count, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("mirror_extension_activity")
        .select("id, hostname, chamber, word_count, captured_at")
        .eq("user_id", user.id)
        .order("captured_at", { ascending: false })
        .limit(8),
    ]);

  if (chamberError || queueError || docsError) {
    return NextResponse.json(
      { error: chamberError?.message || queueError?.message || docsError?.message || "Failed to load mirror dashboard" },
      { status: 500 }
    );
  }

  const chamberMap = Object.fromEntries(
    CHAMBERS.map((key) => {
      const row = (chamberRows || []).find((item) => item.chamber === key);
      return [
        key,
        row
          ? {
              confidenceLevel: row.confidence_level || 0,
              confidenceLabel: getConfidenceLabel(row.confidence_level || 0),
              documentCount: row.document_count || 0,
              totalWordCount: row.total_word_count || 0,
              lastTrainedAt: row.last_trained_at || null,
              updatedAt: row.updated_at || null,
            }
          : {
              confidenceLevel: 0,
              confidenceLabel: "Not Started",
              documentCount: 0,
              totalWordCount: 0,
              lastTrainedAt: null,
              updatedAt: null,
            },
      ];
    })
  );

  const recentCaptures = [
    ...((docs || []).map((doc) => ({
      id: `doc-${doc.id}`,
      type: "document" as const,
      label: doc.file_name || "Mirror document",
      chamber: doc.writing_type || "general",
      wordCount: doc.word_count || 0,
      capturedAt: doc.created_at,
    })) || []),
    ...((extensionRows || []).map((row) => ({
      id: `ext-${row.id}`,
      type: "extension" as const,
      label: row.hostname || "Extension capture",
      chamber: row.chamber || "general",
      wordCount: row.word_count || 0,
      capturedAt: row.captured_at,
    })) || []),
  ]
    .sort((a, b) => new Date(b.capturedAt || 0).getTime() - new Date(a.capturedAt || 0).getTime())
    .slice(0, 8);

  if (extensionError && !String(extensionError.message || "").includes("does not exist")) {
    return NextResponse.json({ error: extensionError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    overall: chamberMap.overall,
    chambers: chamberMap,
    queueCount: queueCount || 0,
    recentCaptures,
  });
}
