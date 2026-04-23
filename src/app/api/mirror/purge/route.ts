import { NextRequest, NextResponse } from "next/server.js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleMirrorPurgePost } from "@/app/api/mirror/purge/handler";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return await handleMirrorPurgePost(req, {
    resolveUserId: async () => {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      return authError || !user ? null : user.id;
    },
    createSupabase: async () => await createSupabaseServerClient(),
  });
}
