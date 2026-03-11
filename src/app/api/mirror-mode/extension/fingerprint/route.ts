import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser, createSupabaseAdmin } from "@/lib/auth/getAuthUser";
import { checkRateLimit } from "@/lib/api/rateLimiter";
import {
  ingestExtensionFingerprint,
  type ExtensionFingerprint,
} from "@/lib/mirror-mode/extension/ingestion";

export const runtime = "nodejs";

function isChamber(value: string): value is ExtensionFingerprint["chamber"] {
  return value === "career" || value === "academic" || value === "creative" || value === "general";
}

function isValidFingerprint(body: any): body is ExtensionFingerprint {
  return (
    body &&
    typeof body === "object" &&
    typeof body.sessionId === "string" &&
    isChamber(String(body.chamber)) &&
    body.sourceType === "extension" &&
    typeof body.wordCount === "number"
  );
}

async function resolveUserId(request: NextRequest): Promise<string | null> {
  const auth = await getAuthUser();
  if (!auth.error && auth.userId) {
    return auth.userId;
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) return null;

  return data.user.id;
}

export async function POST(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) {
    console.warn("[Mirror Extension Fingerprint] Unauthorized request");
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidFingerprint(body)) {
    return NextResponse.json({ success: false, error: "Invalid fingerprint payload" }, { status: 400 });
  }

  const rate = checkRateLimit(userId, "mirror-extension-fingerprint", {
    maxRequests: 50,
    windowMs: 60 * 60 * 1000,
  });
  if (rate.limited) {
    return NextResponse.json({ success: true, captured: false, chamber: body.chamber }, { status: 200 });
  }

  const hostname =
    (request.headers.get("x-extension-hostname") || "").trim() ||
    request.headers.get("x-forwarded-host") ||
    "unknown";

  try {
    const supabase = createSupabaseAdmin();
    const result = await ingestExtensionFingerprint({
      supabase,
      userId,
      fingerprint: body,
      hostname,
    });

    return NextResponse.json(
      {
        success: true,
        captured: result.captured,
        chamber: result.chamber,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Mirror Extension Fingerprint]", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process fingerprint",
      },
      { status: 500 }
    );
  }
}
