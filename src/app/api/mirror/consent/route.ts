import { NextRequest, NextResponse } from "next/server.js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ConsentStudio = "career" | "academic" | "creative" | "general";

const CONSENT_STUDIOS: ConsentStudio[] = [
  "career",
  "academic",
  "creative",
  "general",
];

function isConsentStudio(value: string | null | undefined): value is ConsentStudio {
  return !!value && CONSENT_STUDIOS.includes(value as ConsentStudio);
}

async function getUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return {
    supabase,
    userId: error || !user ? null : user.id,
  };
}

export async function GET(req: NextRequest) {
  const { supabase, userId } = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studio = req.nextUrl.searchParams.get("studio");
  const { data, error } = await supabase
    .from("mirror_mode_consent")
    .select("id, studio, consented_at")
    .eq("user_id", userId)
    .in("studio", studio && isConsentStudio(studio) ? [studio] : CONSENT_STUDIOS);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const state = CONSENT_STUDIOS.reduce<Record<ConsentStudio, { consented: boolean; consented_at: string | null }>>(
    (acc, key) => {
      const row = (data || []).find((item) => item.studio === key);
      acc[key] = {
        consented: Boolean(row?.id),
        consented_at: row?.consented_at || null,
      };
      return acc;
    },
    {
      career: { consented: false, consented_at: null },
      academic: { consented: false, consented_at: null },
      creative: { consented: false, consented_at: null },
      general: { consented: false, consented_at: null },
    }
  );

  if (studio && isConsentStudio(studio)) {
    return NextResponse.json(state[studio]);
  }

  return NextResponse.json({ success: true, consent: state });
}

export async function POST(req: NextRequest) {
  const { supabase, userId } = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const studio = body?.studio;
  if (!isConsentStudio(studio)) {
    return NextResponse.json({ error: "Valid studio is required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("mirror_mode_consent").upsert(
    {
      user_id: userId,
      studio,
      consented_at: now,
      updated_at: now,
    },
    { onConflict: "user_id,studio" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, consented: true, consented_at: now });
}

export async function DELETE(req: NextRequest) {
  const { supabase, userId } = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const studio = body?.studio;
  if (!isConsentStudio(studio)) {
    return NextResponse.json({ error: "Valid studio is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("mirror_mode_consent")
    .delete()
    .eq("user_id", userId)
    .eq("studio", studio);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, consented: false });
}
