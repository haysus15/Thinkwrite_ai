// Single Application API Route
// src/app/api/applications/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, createSupabaseAdmin } from "@/lib/auth/getAuthUser";
import { Errors } from "@/lib/api/errors";

export const runtime = "nodejs";

/* ------------------------------------------------------------------ */
/* GET /api/applications/[id]
   Fetch single application with timeline & reminders
/* ------------------------------------------------------------------ */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: applicationId } = await params;

    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();

    // Fetch application
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .eq('user_id', userId)
      .single();

    if (appError || !application) {
      return Errors.notFound('Application');
    }

    // Fetch timeline
    const { data: timeline } = await supabase
      .from('application_timeline')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false });

    // Fetch reminders
    const { data: reminders } = await supabase
      .from('application_reminders')
      .select('*')
      .eq('application_id', applicationId)
      .eq('is_completed', false)
      .eq('is_dismissed', false)
      .order('remind_at', { ascending: true });

    return NextResponse.json({
      success: true,
      application,
      timeline: timeline || [],
      reminders: reminders || [],
    });

  } catch (error: any) {
    console.error('[Application GET]:', error?.message);
    return Errors.internal();
  }
}

/* ------------------------------------------------------------------ */
/* PATCH /api/applications/[id]
   Update application fields
/* ------------------------------------------------------------------ */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: applicationId } = await params;

    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const body = await req.json();

    // Build update object
    const update: Record<string, any> = {};

    // Status & outcome
    if (body.status !== undefined) update.status = body.status;
    if (body.outcome !== undefined) update.outcome = body.outcome;

    // Applied fields
    if (body.applied_method !== undefined) update.applied_method = body.applied_method;
    if (body.applied_notes !== undefined) update.applied_notes = body.applied_notes;
    if (body.applied_at !== undefined) update.applied_at = body.applied_at;

    // Response fields
    if (body.response_received_at !== undefined) update.response_received_at = body.response_received_at;
    if (body.response_type !== undefined) update.response_type = body.response_type;
    if (body.response_notes !== undefined) update.response_notes = body.response_notes;

    // Interview fields
    if (body.interview_scheduled !== undefined) update.interview_scheduled = body.interview_scheduled;
    if (body.interview_date !== undefined) update.interview_date = body.interview_date;
    if (body.interview_round !== undefined) update.interview_round = body.interview_round;
    if (body.interview_type !== undefined) update.interview_type = body.interview_type;
    if (body.interview_location !== undefined) update.interview_location = body.interview_location;
    if (body.interviewer_names !== undefined) update.interviewer_names = body.interviewer_names;
    if (body.interview_notes !== undefined) update.interview_notes = body.interview_notes;
    if (body.prep_completed !== undefined) update.prep_completed = body.prep_completed;
    if (body.interview_ready !== undefined) update.interview_ready = body.interview_ready;

    // Outcome fields
    if (body.outcome_date !== undefined) update.outcome_date = body.outcome_date;
    if (body.outcome_notes !== undefined) update.outcome_notes = body.outcome_notes;

    // Offer fields
    if (body.offer_salary_min !== undefined) update.offer_salary_min = body.offer_salary_min;
    if (body.offer_salary_max !== undefined) update.offer_salary_max = body.offer_salary_max;
    if (body.offer_deadline !== undefined) update.offer_deadline = body.offer_deadline;
    if (body.offer_accepted !== undefined) update.offer_accepted = body.offer_accepted;

    // Rejection fields
    if (body.rejection_reason !== undefined) update.rejection_reason = body.rejection_reason;
    if (body.rejection_feedback !== undefined) update.rejection_feedback = body.rejection_feedback;

    // Notes & organization
    if (body.user_notes !== undefined) update.user_notes = body.user_notes;
    if (body.follow_up_date !== undefined) update.follow_up_date = body.follow_up_date;
    if (body.follow_up_notes !== undefined) update.follow_up_notes = body.follow_up_notes;
    if (body.priority !== undefined) update.priority = body.priority;
    if (body.tags !== undefined) update.tags = body.tags;

    // Archive
    if (body.is_archived !== undefined) update.is_archived = body.is_archived;

    const { data: application, error } = await supabase
      .from('applications')
      .update(update)
      .eq('id', applicationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return Errors.databaseError(error.message);
    }

    return NextResponse.json({
      success: true,
      application,
    });

  } catch (error: any) {
    console.error('[Application PATCH]:', error?.message);
    return Errors.internal();
  }
}

/* ------------------------------------------------------------------ */
/* DELETE /api/applications/[id]
   Archive application (soft delete)
/* ------------------------------------------------------------------ */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: applicationId } = await params;

    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();

    const { error } = await supabase
      .from('applications')
      .update({ is_archived: true })
      .eq('id', applicationId)
      .eq('user_id', userId);

    if (error) {
      return Errors.databaseError(error.message);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[Application DELETE]:', error?.message);
    return Errors.internal();
  }
}
