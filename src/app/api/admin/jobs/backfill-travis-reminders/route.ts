import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/auth/getAuthUser";
import {
  BACKFILL_TRAVIS_REMINDERS_JOB_NAME,
  backfillTravisReminders,
  countBackfillableTravisReminders,
} from "@/lib/jobs/backfillTravisReminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminHeader = request.headers.get("x-admin-key");
  const authorization = request.headers.get("authorization") || "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  return Boolean(
    (adminSecret && adminHeader === adminSecret) ||
      (serviceRoleKey && bearerToken === serviceRoleKey)
  );
}

async function getLatestBackfillJob() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("background_jobs")
    .select("id, job_name, status, result, started_at, completed_at")
    .eq("job_name", BACKFILL_TRAVIS_REMINDERS_JOB_NAME)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load background job status");
  }

  return data;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseAdmin();
  const runningJob = await getLatestBackfillJob();

  if (runningJob?.status === "running") {
    const estimatedRows = await countBackfillableTravisReminders();
    return NextResponse.json({
      jobId: runningJob.id,
      status: "already_running",
      estimatedRows,
    });
  }

  const estimatedRows = await countBackfillableTravisReminders();

  const { data: job, error: insertError } = await supabase
    .from("background_jobs")
    .insert({
      job_name: BACKFILL_TRAVIS_REMINDERS_JOB_NAME,
      status: "running",
      result: null,
    })
    .select("id")
    .single();

  if (insertError || !job) {
    return NextResponse.json(
      { error: insertError?.message || "Failed to create background job" },
      { status: 500 }
    );
  }

  void (async () => {
    try {
      const result = await backfillTravisReminders();
      await supabase
        .from("background_jobs")
        .update({
          status: "complete",
          result,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await supabase
        .from("background_jobs")
        .update({
          status: "failed",
          result: { error: message },
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }
  })();

  return NextResponse.json({
    jobId: job.id,
    status: "started",
    estimatedRows,
  });
}
