import { NextRequest } from "next/server.js";
import { createSupabaseAdmin, getAuthUser } from "@/lib/auth/getAuthUser";
import { handleGetUnclassified } from "@/app/api/mirror/unclassified/handler";

export const runtime = "nodejs";

async function resolveUserId(): Promise<string | null> {
  const auth = await getAuthUser();
  return auth.error ? null : auth.userId;
}

export async function GET(request: NextRequest) {
  return await handleGetUnclassified(request, {
    resolveUserId,
    createSupabaseAdmin,
  });
}
