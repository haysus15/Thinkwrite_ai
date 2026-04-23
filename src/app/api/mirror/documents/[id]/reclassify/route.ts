import { NextRequest } from "next/server.js";
import { createSupabaseAdmin, getAuthUser } from "@/lib/auth/getAuthUser";
import { handleReclassifyDocument } from "@/app/api/mirror/documents/[id]/reclassify/handler";

export const runtime = "nodejs";

async function resolveUserId(): Promise<string | null> {
  const auth = await getAuthUser();
  return auth.error ? null : auth.userId;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return await handleReclassifyDocument(request, await params, {
    resolveUserId,
    createSupabaseAdmin,
  });
}
