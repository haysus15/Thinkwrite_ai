// Application Transition API Route
// src/app/api/applications/transition/route.ts

import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseAdmin } from "@/lib/auth/getAuthUser";
import { Errors } from "@/lib/api/errors";

export const runtime = "nodejs";

async function safeJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const body = await safeJson(req);

    const job_analysis_id = body.job_analysis_id as string;
    const applied_method = (body.applied_method as string) || "company_website";
    const job_url = body.job_url ?? null;

    if (!job_analysis_id) {
      return Errors.missingField("job_analysis_id");
    }

    // Pull title/company/location from job_analyses for denormalized fields
    const { data: job, error: jobErr } = await supabase
      .from("job_analyses")
      .select("id, job_title, company_name, location")
      .eq("id", job_analysis_id)
      .eq("user_id", userId)
      .single();

    if (jobErr || !job) {
      return Errors.notFound("Job analysis");
    }

    // Find existing application for this user+job_analysis_id (not archived)
    const { data: existing, error: existingErr } = await supabase
      .from("applications")
      .select("id,status")
      .eq("user_id", userId)
      .eq("job_analysis_id", job_analysis_id)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingErr) {
      return Errors.databaseError(existingErr.message);
    }

    const nowIso = new Date().toISOString();
    let applicationId: string | null = null;

    if (existing && existing.length > 0) {
      // Update existing application
      applicationId = existing[0].id;

      const { error: updErr } = await supabase
        .from("applications")
        .update({
          status: "applied",
          applied_at: nowIso,
          applied_method,
          job_url,
        })
        .eq("id", applicationId)
        .eq("user_id", userId);

      if (updErr) {
        return Errors.databaseError(updErr.message);
      }
    } else {
      // Create new application
      const { data: created, error: insErr } = await supabase
        .from("applications")
        .insert({
          user_id: userId,
          job_analysis_id,
          job_title: job.job_title,
          company_name: job.company_name,
          location: job.location ?? null,
          job_url,
          status: "applied",
          saved_at: nowIso,
          applied_at: nowIso,
          applied_method,
        })
        .select("id")
        .single();

      if (insErr) {
        return Errors.databaseError(insErr.message);
      }
      applicationId = created?.id ?? null;
    }

    // Update job_analyses flags too
    const { error: jaErr } = await supabase
      .from("job_analyses")
      .update({ has_applied: true, applied_at: nowIso })
      .eq("id", job_analysis_id)
      .eq("user_id", userId);

    if (jaErr) {
      return Errors.databaseError(jaErr.message);
    }

    return NextResponse.json({ success: true, application_id: applicationId });
  } catch (e: any) {
    console.error("[Applications transition]:", e?.message);
    return Errors.internal();
  }
}
