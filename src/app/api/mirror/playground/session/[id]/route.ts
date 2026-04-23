import { NextRequest } from "next/server.js";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ingestConversationMessage,
  shouldIngest,
} from "@/lib/mirror-mode/playgroundIngestion";
import {
  extractContextObservations,
  generateUrsieRecommendationMessage,
} from "@/lib/mirror-core/contextMemoryService";
import { handleGetPlaygroundSession, handleUpdatePlaygroundSession } from "./handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  return handleGetPlaygroundSession(request, params, {
    resolveUserId: async () => {
      const auth = await getAuthUser();
      return auth.userId ?? null;
    },
    createSupabaseServerClient,
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  return handleUpdatePlaygroundSession(request, params, {
    resolveUserId: async () => {
      const auth = await getAuthUser();
      return auth.userId ?? null;
    },
    createSupabaseServerClient,
    shouldIngest,
    ingestConversationMessage,
    extractContextObservations,
    generateUrsieRecommendationMessage,
  });
}
