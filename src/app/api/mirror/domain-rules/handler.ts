import { NextRequest, NextResponse } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isChamber,
  normalizeDomain,
} from "@/lib/mirror-core/classification";
import type { Chamber } from "@/lib/mirror-core/writingTypes";

type DomainRuleRow = {
  id: string;
  domain: string;
  target_chamber: Chamber;
  created_at: string;
  updated_at: string;
};

type DomainRuleCreateBody = {
  domain: string;
  target_chamber: string;
};

export type DomainRulesDeps = {
  resolveUserId: (request: NextRequest) => Promise<string | null>;
  createSupabaseAdmin: () => SupabaseClient;
};

async function readJsonBody<T>(request: NextRequest): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export async function handleGetDomainRules(
  request: NextRequest,
  deps: DomainRulesDeps
) {
  const userId = await deps.resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = deps.createSupabaseAdmin();
  const { data, error } = await supabase
    .from("mirror_domain_rules")
    .select("id, domain, target_chamber, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    rules: (data || []) as DomainRuleRow[],
  });
}

export async function handlePostDomainRule(
  request: NextRequest,
  deps: DomainRulesDeps
) {
  const userId = await deps.resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody<DomainRuleCreateBody>(request);
  const domain = normalizeDomain(body?.domain || "");
  const targetChamber = body?.target_chamber;

  if (!domain || !isChamber(targetChamber)) {
    return NextResponse.json(
      { error: "Invalid domain rule payload" },
      { status: 400 }
    );
  }

  const supabase = deps.createSupabaseAdmin();
  const { data: existing } = await supabase
    .from("mirror_domain_rules")
    .select("id, target_chamber")
    .eq("user_id", userId)
    .eq("domain", domain)
    .maybeSingle();

  if (existing?.id && existing.target_chamber === targetChamber) {
    return NextResponse.json(
      { error: "domain_rule_exists" },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("mirror_domain_rules")
    .upsert(
      {
        user_id: userId,
        domain,
        target_chamber: targetChamber,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,domain" }
    )
    .select("id, domain, target_chamber, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    rule: data as DomainRuleRow,
  });
}
