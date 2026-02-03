// src/app/api/victor/challenge/intensity/[subject]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: { subject: string } }
) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("challenge_intensity")
    .select("intensity_level")
    .eq("user_id", userId)
    .eq("subject", params.subject)
    .maybeSingle();

  return NextResponse.json(
    { success: true, intensity: data?.intensity_level ?? 3 },
    { status: 200 }
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { subject: string } }
) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const intensity = Number(body?.intensity);

  if (!Number.isInteger(intensity) || intensity < 1 || intensity > 5) {
    return NextResponse.json(
      { success: false, error: "Intensity must be 1-5." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error: upsertError } = await supabase
    .from("challenge_intensity")
    .upsert(
      {
        user_id: userId,
        subject: params.subject,
        intensity_level: intensity,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,subject" }
    );

  if (upsertError) {
    return NextResponse.json(
      { success: false, error: upsertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, intensity }, { status: 200 });
}
