import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseAdmin } from "@/lib/auth/getAuthUser";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getAuthUser();
  if (auth.error || !auth.userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("mirror_extension_activity")
      .select("hostname, chamber, captured_at")
      .eq("user_id", auth.userId)
      .gte("captured_at", weekAgo)
      .order("captured_at", { ascending: false });

    if (error) {
      if (String(error.message || "").includes("relation") || String(error.message || "").includes("does not exist")) {
        return NextResponse.json({ success: true, extensionConnected: false, weeklyCount: 0, domainBreakdown: [] });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const rows = data || [];
    const grouped = new Map<string, { hostname: string; count: number; chamber: string; lastCapturedAt: string }>();

    for (const row of rows) {
      const existing = grouped.get(row.hostname);
      if (!existing) {
        grouped.set(row.hostname, {
          hostname: row.hostname,
          count: 1,
          chamber: row.chamber || "general",
          lastCapturedAt: row.captured_at,
        });
      } else {
        existing.count += 1;
        if (new Date(row.captured_at).getTime() > new Date(existing.lastCapturedAt).getTime()) {
          existing.lastCapturedAt = row.captured_at;
          existing.chamber = row.chamber || existing.chamber;
        }
      }
    }

    const domainBreakdown = Array.from(grouped.values()).sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      weeklyCount: rows.length,
      domainBreakdown,
      extensionConnected: rows.length > 0,
    });
  } catch (error) {
    console.error("[Mirror Extension Activity]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
