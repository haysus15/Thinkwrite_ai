import { NextRequest, NextResponse } from "next/server.js";
import { createSupabaseAdmin } from "@/lib/auth/getAuthUser";

type DomainRuleDeleteDeps = {
  resolveUserId: (request: NextRequest) => Promise<string | null>;
  createSupabaseAdmin: () => ReturnType<typeof createSupabaseAdmin>;
};

export async function handleDeleteDomainRule(
  request: NextRequest,
  params: { id: string },
  deps: DomainRuleDeleteDeps
) {
  const userId = await deps.resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = deps.createSupabaseAdmin();
  const { error } = await supabase
    .from("mirror_domain_rules")
    .delete()
    .eq("id", params.id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
