// src/app/api/career-assessment/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';
import { checkRateLimit } from '@/lib/api/rateLimiter';

// GET - Retrieve existing assessment
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();

    // Get most recent assessment
    const { data: assessment, error } = await supabase
      .from('career_assessments')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Error fetching assessment:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Transform snake_case to camelCase for frontend
    if (assessment) {
      console.log('✅ Assessment found:', assessment.id);
      console.log('📊 Has profile?', !!assessment.profile);
      console.log('📊 Has action_plan?', !!assessment.action_plan);
      
      return NextResponse.json({
        success: true,
        assessment: {
          id: assessment.id,
          userId: assessment.user_id,
          resumeId: assessment.resume_id,
          profile: assessment.profile,
          actionPlan: assessment.action_plan, // 🔧 Convert to camelCase
          conversationMessages: assessment.conversation_messages,
          status: assessment.status,
          createdAt: assessment.created_at,
          completedAt: assessment.completed_at,
          updatedAt: assessment.updated_at,
        },
      });
    }

    console.log('📭 No assessment found');
    return NextResponse.json({
      success: true,
      assessment: null,
    });
  } catch (error: any) {
    console.error('❌ Error in GET /api/career-assessment:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Save new assessment
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    // Rate limiting
    const { limited, resetIn } = checkRateLimit(userId, 'career-assessment');
    if (limited) {
      return Errors.rateLimited(Math.ceil(resetIn / 1000));
    }

    const supabase = createSupabaseAdmin();
    const body = await request.json();
    const { resumeId, conversationMessages, profile, actionPlan } = body;

    // Create new assessment
    const { data: assessment, error } = await supabase
      .from('career_assessments')
      .insert({
        user_id: userId,
        resume_id: resumeId || null,
        conversation_messages: conversationMessages || [],
        profile: profile || null,
        action_plan: actionPlan || null,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error saving assessment:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Assessment saved:', assessment.id);

    return NextResponse.json({
      success: true,
      assessment,
    });
  } catch (error: any) {
    console.error('❌ Error in POST /api/career-assessment:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}