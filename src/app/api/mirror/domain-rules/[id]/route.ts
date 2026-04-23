import { NextRequest } from "next/server.js";
import { getAuthUser, createSupabaseAdmin } from "@/lib/auth/getAuthUser";
import { handleDeleteDomainRule } from "@/app/api/mirror/domain-rules/[id]/handler";

export const runtime = "nodejs";

async function resolveUserId(): Promise<string | null> {
  const auth = await getAuthUser();
  return auth.error ? null : auth.userId;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return await handleDeleteDomainRule(request, await params, {
    resolveUserId,
    createSupabaseAdmin,
  });
}
