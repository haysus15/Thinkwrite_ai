import { NextRequest } from "next/server.js";
import { getAuthUser, createSupabaseAdmin } from "@/lib/auth/getAuthUser";
import {
  handleGetContextMemory,
  handlePostContextMemory,
} from "@/app/api/mirror/context-memory/handler";

export const runtime = "nodejs";

async function resolveUserId(): Promise<string | null> {
  const auth = await getAuthUser();
  return auth.error ? null : auth.userId;
}

export async function GET(request: NextRequest) {
  return await handleGetContextMemory(request, {
    resolveUserId,
    createSupabaseAdmin,
  });
}

export async function POST(request: NextRequest) {
  return await handlePostContextMemory(request, {
    resolveUserId,
    createSupabaseAdmin,
  });
}
