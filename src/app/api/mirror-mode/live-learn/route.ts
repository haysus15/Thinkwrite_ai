// src/app/api/mirror-mode/live-learn/route.ts
// Live learning feed (NO CACHE + correct table + consistent field mapping)

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { learnFromTextDirect, type LearningSource } from "@/lib/mirror-mode/liveLearning";
import {
  SOURCE_AUTHORITY,
  type SourceAuthority,
} from "@/lib/mirror-mode/sourceAuthority";
import { getSourceLabel } from "@/lib/mirror-mode/ingestionPolicy";

export const runtime = "nodejs";

// 🚫 prevent Next/Vercel caching
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "Surrogate-Control": "no-store",
};

type MirrorDocRow = {
  id: string;
  file_name: string | null;
  writing_type: string | null;
  source_authority: string | null;
  word_count: number | null;
  learned_at: string | null;
  created_at: string | null;
  analyzed_at?: string | null; // optional if your table has it
};

const ALLOWED_SOURCES: LearningSource[] = [
  "cover-letter",
  "lex-chat",
  "coding-review",
  "resume-upload",
  "resume-builder",
  "tailored-resume",
  "manual-upload",
  "other",
];

function normalizeSourceAuthority(value: string | null | undefined): SourceAuthority {
  const sourceValues = Object.values(SOURCE_AUTHORITY) as SourceAuthority[];
  if (value && sourceValues.includes(value as SourceAuthority)) {
    return value as SourceAuthority;
  }
  return SOURCE_AUTHORITY.UNKNOWN;
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const limitRaw = searchParams.get("limit") || "10";
    const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 10, 1), 50);

    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401, headers: noStoreHeaders }
      );
    }

    const supabase = await createSupabaseServerClient();
    /**
     * ✅ IMPORTANT FIX:
     * Your other routes use `mirror_documents` (NOT `mirror_mode_documents`).
     * If your dashboard shows “old” activity, it may be reading from a different table.
     *
     * This route is updated to use `mirror_documents` and its fields:
     * - learned_at
     * - created_at
     * - (optional) analyzed_at if present
     */
    const { data: activities, error } = await supabase
      .from("mirror_documents")
      .select(
        "id, file_name, writing_type, source_authority, word_count, learned_at, created_at, analyzed_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching learning activities:", error);
      return NextResponse.json(
        { success: false, error: error.message || "Failed to fetch learning activities" },
        { status: 500, headers: noStoreHeaders }
      );
    }

    const rows = (activities || []) as MirrorDocRow[];

    const learningFeed = rows.map((row) => {
      const writingType = row.writing_type || "other";
      const source = mapWritingTypeToSource(writingType);
      const sourceAuthority = normalizeSourceAuthority(row.source_authority);

      const createdAt = row.analyzed_at || row.created_at || new Date().toISOString();

      return {
        id: row.id,
        source,
        source_label: getSourceLabel(sourceAuthority),
        word_count: row.word_count || 0,
        title: row.file_name || "Untitled",
        context: row.learned_at ? "Learned" : "Processing",
        created_at: createdAt,
      };
    });

    return NextResponse.json(
      { success: true, activity: learningFeed, total: learningFeed.length },
      { status: 200, headers: noStoreHeaders }
    );
  } catch (error: any) {
    console.error("Live learning feed error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401, headers: noStoreHeaders }
      );
    }

    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const sourceRaw = typeof body?.source === "string" ? body.source.trim() : "";
    const metadata = body?.metadata && typeof body.metadata === "object" ? body.metadata : {};

    if (!text) {
      return NextResponse.json(
        { success: false, error: "text is required" },
        { status: 400, headers: noStoreHeaders }
      );
    }
    if (!sourceRaw) {
      return NextResponse.json(
        { success: false, error: "source is required" },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const source: LearningSource = ALLOWED_SOURCES.includes(sourceRaw as LearningSource)
      ? (sourceRaw as LearningSource)
      : "other";

    const result = await learnFromTextDirect({
      userId,
      text,
      source,
      // Live learn API ingests as direct user input.
      sourceAuthority: SOURCE_AUTHORITY.USER_TYPED,
      metadata: {
        documentId:
          typeof metadata.documentId === "string" ? metadata.documentId : undefined,
        title: typeof metadata.title === "string" ? metadata.title : undefined,
        context: typeof metadata.context === "string" ? metadata.context : undefined,
        writingType:
          typeof metadata.writingType === "string" ? metadata.writingType : undefined,
      },
    });

    return NextResponse.json(
      result.learned
        ? { success: true }
        : { success: false, error: result.error || "Could not learn from this input." },
      { status: 200, headers: noStoreHeaders }
    );
  } catch (error: any) {
    console.error("Live learning POST error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

// Helper functions to map writing types to sources
function mapWritingTypeToSource(writingType: string): string {
  const mapping: Record<string, string> = {
    "cover-letter": "cover-letter",
    professional: "manual-upload",
    creative: "manual-upload",
    academic: "manual-upload",
    personal: "manual-upload",
    technical: "manual-upload",
    casual: "lex-chat",
    resume: "resume-upload",
    tailored: "tailored-resume",
  };

  return mapping[writingType] || "other";
}
