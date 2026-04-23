import { NextRequest } from "next/server.js";
import { createSupabaseAdmin, getAuthUser } from "@/lib/auth/getAuthUser";
import {
  handleDeleteSubcategory,
  handlePatchSubcategory,
} from "@/app/api/mirror/subcategories/handler";

export const runtime = "nodejs";

async function resolveUserId(): Promise<string | null> {
  const auth = await getAuthUser();
  return auth.error ? null : auth.userId;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  return await handlePatchSubcategory(request, params, {
    resolveUserId,
    createSupabaseAdmin,
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  return await handleDeleteSubcategory(request, params, {
    resolveUserId,
    createSupabaseAdmin,
  });
}
