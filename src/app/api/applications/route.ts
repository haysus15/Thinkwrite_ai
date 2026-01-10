// Applications API Route
// src/app/api/applications/route.ts

import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseAdmin } from "@/lib/auth/getAuthUser";
import { Errors } from "@/lib/api/errors";

export const runtime = "nodejs";

type AppStatus = "saved" | "applied" | "response" | "interview";
type Outcome = "offer" | "rejected" | "withdrawn" | "ghosted" | "pending";

async function safeJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* GET /api/applications
/* ------------------------------------------------------------------ */
export async function GET(req: Request) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const includeArchived = url.searchParams.get("includeArchived") === "true";
    const q = (url.searchParams.get("q") || "").trim();
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);

    if (includeArchived) {
      let query = supabase
        .from("applications_insights")
        .select("*")
        .eq("user_id", userId)
        .eq("is_archived", true)
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (q) query = query.or(`company_name.ilike.%${q}%,job_title.ilike.%${q}%`);
      if (status) query = query.eq("status", status);

      const { data, error } = await query;
      if (error) {
        return Errors.databaseError(error.message);
      }

      return NextResponse.json({ success: true, applications: data ?? [] });
    }

    let query = supabase
      .from("application_insights")
      .select("*")
      .eq("user_id", userId)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);
    if (q) query = query.or(`company_name.ilike.%${q}%,job_title.ilike.%${q}%`);

    const { data, error } = await query;

    if (error) {
      return Errors.databaseError(error.message);
    }

    return NextResponse.json({ success: true, applications: data ?? [] });
  } catch (e: any) {
    console.error("[Applications GET]:", e?.message);
    return Errors.internal();
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/applications
/* ------------------------------------------------------------------ */
export async function POST(req: Request) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const body = await req.json();

    const jobAnalysisId = body.job_analysis_id ?? body.jobAnalysisId ?? null;
    let job_title = body.job_title;
    let company_name = body.company_name;

    // Look up job details if needed
    if (jobAnalysisId && (!job_title || !company_name)) {
      const { data: job, error: jobErr } = await supabase
        .from("job_analyses")
        .select("id, job_title, company_name, location")
        .eq("id", jobAnalysisId)
        .maybeSingle();

      if (jobErr) {
        return Errors.databaseError(jobErr.message);
      }

      if (job) {
        job_title = job_title || job.job_title;
        company_name = company_name || job.company_name;
        body.location = body.location ?? job.location ?? null;
      }
    }

    if (!job_title || !company_name) {
      return Errors.validationError("job_title and company_name required");
    }

    // Check for duplicates
    if (jobAnalysisId) {
      const { data: existingList } = await supabase
        .from("applications")
        .select("id, created_at")
        .eq("user_id", userId)
        .eq("job_analysis_id", jobAnalysisId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (existingList && existingList.length > 0) {
        const existing = existingList[0];
        return NextResponse.json({
          success: true,
          existing: { id: existing.id },
          message: 'Application already tracked'
        });
      }
    }

    const payload = {
      user_id: userId,
      job_analysis_id: jobAnalysisId,
      tailored_resume_id: body.tailored_resume_id ?? null,
      cover_letter_id: body.cover_letter_id ?? null,
      job_title,
      company_name,
      location: body.location ?? null,
      job_url: body.job_url ?? null,
      status: (body.status ?? "saved") as AppStatus,
      priority: body.priority ?? "medium",
      tags: body.tags ?? null,
      user_notes: body.user_notes ?? null,
    };

    const { data, error } = await supabase
      .from("applications")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      // Handle duplicate constraint
      if (error.code === '23505' || error.message?.includes('applications_user_job_unique')) {
        const { data: existing } = await supabase
          .from("applications")
          .select("*")
          .eq("user_id", userId)
          .eq("job_analysis_id", jobAnalysisId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (existing) {
          return NextResponse.json({
            success: true,
            existing: existing,
            message: 'Application already exists'
          });
        }
      }

      return Errors.databaseError(error.message);
    }

    return NextResponse.json({ success: true, application: data });
  } catch (e: any) {
    console.error("[Applications POST]:", e?.message);
    return Errors.internal();
  }
}

/* ------------------------------------------------------------------ */
/* PATCH /api/applications
/* ------------------------------------------------------------------ */
export async function PATCH(req: Request) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const body = await safeJson(req);

    const id = String(body.id || "").trim();
    if (!id) {
      return Errors.missingField("id");
    }

    const update: Record<string, any> = {};

    if (body.status) update.status = body.status as AppStatus;
    if (body.outcome) update.outcome = body.outcome as Outcome;
    if (body.applied_method !== undefined) update.applied_method = body.applied_method;
    if (body.applied_notes !== undefined) update.applied_notes = body.applied_notes;
    if (body.applied_at !== undefined) update.applied_at = body.applied_at;
    if (body.interview_scheduled !== undefined) update.interview_scheduled = body.interview_scheduled;
    if (body.interview_date !== undefined) update.interview_date = body.interview_date;
    if (body.interview_type !== undefined) update.interview_type = body.interview_type;
    if (body.interview_location !== undefined) update.interview_location = body.interview_location;
    if (body.interviewer_names !== undefined) update.interviewer_names = body.interviewer_names;
    if (body.user_notes !== undefined) update.user_notes = body.user_notes;
    if (body.follow_up_date !== undefined) update.follow_up_date = body.follow_up_date;
    if (body.follow_up_notes !== undefined) update.follow_up_notes = body.follow_up_notes;
    if (body.priority !== undefined) update.priority = body.priority;
    if (body.tags !== undefined) update.tags = body.tags;
    if (body.is_archived !== undefined) update.is_archived = body.is_archived;

    const { data, error } = await supabase
      .from("applications")
      .update(update)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) {
      return Errors.databaseError(error.message);
    }

    return NextResponse.json({ success: true, application: data });
  } catch (e: any) {
    console.error("[Applications PATCH]:", e?.message);
    return Errors.internal();
  }
}
