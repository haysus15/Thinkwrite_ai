import { NextRequest } from "next/server.js";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleCreatePlaygroundSession } from "./handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handleCreatePlaygroundSession(request, {
    resolveUserId: async () => {
      const auth = await getAuthUser();
      return auth.userId ?? null;
    },
    createSupabaseServerClient,
  });
}
