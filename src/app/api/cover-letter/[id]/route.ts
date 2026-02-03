// ============================================================
// THINKWRITE AI - COVER LETTER MANAGEMENT API
// ============================================================
// Path: app/api/cover-letter/[id]/route.ts
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';

// ============================================================
// GET - Get specific cover letter
// ============================================================

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
      .from('cover_letters')
      .select(`
        *,
        achievements:cover_letter_achievements(*)
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Cover letter not found' }, { status: 404 });
    }

    // Get version history if this letter has versions
    let versionHistory: any[] = [];
    if (data.parent_id || data.version > 1) {
      const parentId = data.parent_id || id;
      const { data: versions } = await supabase
        .from('cover_letters')
        .select('id, version, created_at, overall_quality_score')
        .or(`id.eq.${parentId},parent_id.eq.${parentId}`)
        .order('version', { ascending: false });
      
      versionHistory = versions || [];
    }

    return NextResponse.json({
      success: true,
      coverLetter: data,
      versionHistory,
    });

  } catch (error) {
    console.error('Error fetching cover letter:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// ============================================================
// PUT - Update cover letter
// ============================================================

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
    const { ...updates } = body;

    // Verify ownership
    const { data: existing } = await supabase
      .from('cover_letters')
      .select('id, user_id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Cover letter not found' }, { status: 404 });
    }

    // Allowed fields to update
    const allowedFields = [
      'content',
      'content_html',
      'content_sections',
      'company_name',
      'job_title',
      'recipient_name',
      'recipient_title',
      'tone_setting',
      'length_setting',
      'energy_level',
      'focus_areas',
      'status',
      'is_favorite',
      'is_template',
      'template_name',
      'lex_suggestions',
    ];

    const sanitizedUpdates: Record<string, any> = {};
    for (const key of allowedFields) {
      if (key in updates) {
        sanitizedUpdates[key] = updates[key];
      }
    }

    const { data, error } = await supabase
      .from('cover_letters')
      .update(sanitizedUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating cover letter:', error);
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      coverLetter: data,
    });

  } catch (error) {
    console.error('Error in PUT cover letter:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// ============================================================
// DELETE - Delete cover letter
// ============================================================

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

    // Verify ownership before deleting
    const { data: existing } = await supabase
      .from('cover_letters')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Cover letter not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('cover_letters')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting cover letter:', error);
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Cover letter deleted',
    });

  } catch (error) {
    console.error('Error in DELETE cover letter:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}