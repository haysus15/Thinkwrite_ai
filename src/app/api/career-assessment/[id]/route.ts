// Career Assessment [id] API Route
// src/app/api/career-assessment/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';

// GET: Fetch single assessment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const { id } = await params;

    const { data, error } = await supabase
      .from('career_assessments')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'Assessment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      assessment: {
        id: data.id,
        userId: data.user_id,
        status: data.status,
        resumeId: data.resume_id,
        conversationMessages: data.conversation_messages,
        profile: data.profile,
        actionPlan: data.action_plan,
        startedAt: data.started_at,
        completedAt: data.completed_at,
        createdAt: data.created_at
      }
    });

  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch assessment' },
      { status: 500 }
    );
  }
}

// PUT: Update assessment progress
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const { id } = await params;
    const body = await request.json();
    const { answers, currentQuestion, status, timeSpentSeconds } = body;

    const updateData: any = {
      last_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (answers !== undefined) updateData.answers = answers;
    if (currentQuestion !== undefined) updateData.current_question = currentQuestion;
    if (status !== undefined) updateData.status = status;
    if (timeSpentSeconds !== undefined) updateData.time_spent_seconds = timeSpentSeconds;

    const { data, error } = await supabase
      .from('career_assessments')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Update error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, assessment: data });

  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update assessment' },
      { status: 500 }
    );
  }
}

// DELETE: Delete assessment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const { id } = await params;

    const { error } = await supabase
      .from('career_assessments')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete assessment' },
      { status: 500 }
    );
  }
}
