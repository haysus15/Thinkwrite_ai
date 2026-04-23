import { NextRequest } from "next/server.js";
import { createSupabaseAdmin, getAuthUser } from "@/lib/auth/getAuthUser";
import {
  handleGetSubcategories,
  handlePostSubcategories,
} from "@/app/api/mirror/subcategories/handler";

export const runtime = "nodejs";

async function resolveUserId(): Promise<string | null> {
  const auth = await getAuthUser();
  return auth.error ? null : auth.userId;
}

export async function GET(request: NextRequest) {
  return await handleGetSubcategories(request, {
    resolveUserId,
    createSupabaseAdmin,
  });
}

export async function POST(request: NextRequest) {
  return await handlePostSubcategories(request, {
    resolveUserId,
    createSupabaseAdmin,
  });
}
