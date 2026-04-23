import { NextRequest } from "next/server.js";
import { getAuthUser, createSupabaseAdmin } from "@/lib/auth/getAuthUser";
import {
  handleGetDomainRules,
  handlePostDomainRule,
} from "@/app/api/mirror/domain-rules/handler";

export const runtime = "nodejs";

async function resolveUserId(): Promise<string | null> {
  const auth = await getAuthUser();
  return auth.error ? null : auth.userId;
}

export async function GET(request: NextRequest) {
  return await handleGetDomainRules(request, {
    resolveUserId,
    createSupabaseAdmin,
  });
}

export async function POST(request: NextRequest) {
  return await handlePostDomainRule(request, {
    resolveUserId,
    createSupabaseAdmin,
  });
}
