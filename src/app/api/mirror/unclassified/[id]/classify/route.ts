import { NextRequest } from "next/server.js";
import { createSupabaseAdmin, getAuthUser } from "@/lib/auth/getAuthUser";
import { handleClassifyUnclassified } from "@/app/api/mirror/unclassified/handler";

export const runtime = "nodejs";

async function resolveUserId(): Promise<string | null> {
  const auth = await getAuthUser();
  return auth.error ? null : auth.userId;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return await handleClassifyUnclassified(request, await params, {
    resolveUserId,
    createSupabaseAdmin,
  });
}
