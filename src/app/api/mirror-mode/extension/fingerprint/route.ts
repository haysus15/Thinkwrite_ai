import { NextRequest } from "next/server.js";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser, createSupabaseAdmin } from "@/lib/auth/getAuthUser";
import { verifyExtensionSessionToken } from "@/app/api/extension/auth/route";
import {
  handleExtensionFingerprintPost,
} from "@/app/api/mirror-mode/extension/fingerprint/handler";
import { ingestExtensionFingerprint } from "@/lib/mirror-core/extension/ingestion";
import {
  extractContextObservations,
  generateUrsieRecommendationMessage,
} from "@/lib/mirror-core/contextMemoryService";

export const runtime = "nodejs";

async function resolveUserId(request: NextRequest): Promise<string | null> {
  const auth = await getAuthUser();
  if (!auth.error && auth.userId) {
    return auth.userId;
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return null;

  const extensionSession = verifyExtensionSessionToken(token);
  if (extensionSession.valid && extensionSession.payload?.sub) {
    return extensionSession.payload.sub;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) return null;

  return data.user.id;
}

export async function POST(request: NextRequest) {
  return await handleExtensionFingerprintPost(request, {
    resolveUserId,
    createSupabaseAdmin,
    ingestExtensionFingerprint,
    extractContextObservations,
    generateUrsieRecommendationMessage,
  });
}
