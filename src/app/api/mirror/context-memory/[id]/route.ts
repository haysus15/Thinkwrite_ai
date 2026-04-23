import { NextRequest } from "next/server.js";
import { getAuthUser, createSupabaseAdmin } from "@/lib/auth/getAuthUser";
import {
  handleDeleteContextMemory,
  handlePatchContextMemory,
} from "@/app/api/mirror/context-memory/handler";

export const runtime = "nodejs";

async function resolveUserId(): Promise<string | null> {
  const auth = await getAuthUser();
  return auth.error ? null : auth.userId;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return await handlePatchContextMemory(request, await params, {
    resolveUserId,
    createSupabaseAdmin,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return await handleDeleteContextMemory(request, await params, {
    resolveUserId,
    createSupabaseAdmin,
  });
}
