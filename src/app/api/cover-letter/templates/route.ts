// ============================================================
// THINKWRITE AI - COVER LETTER TEMPLATES API
// ============================================================
// Path: app/api/cover-letter/templates/route.ts
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';

// ============================================================
// GET - Get templates (system + user's own)
// ============================================================

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    // Build query - get system templates (user_id IS NULL) and user's own
    let query = supabase
      .from('cover_letter_templates')
      .select('*')
      .eq('is_active', true)
      .or(`user_id.is.null,user_id.eq.${userId}`);

    // Filter by category if specified
    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query.order('usage_count', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }

    // Separate system vs user templates
    const systemTemplates = data?.filter(t => !t.user_id) || [];
    const userTemplates = data?.filter(t => t.user_id) || [];

    return NextResponse.json({
      success: true,
      templates: {
        system: systemTemplates,
        user: userTemplates,
        all: data || [],
      },
    });

  } catch (error) {
    console.error('Error in GET templates:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// ============================================================
// POST - Create user template (save cover letter as template)
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const body = await request.json();
    const {
      name,
      description,
      category,
      openingTemplate,
      bodyTemplate,
      closingTemplate,
      defaultTone,
      defaultLength,
      // Or create from existing cover letter
      coverLetterId,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Template name required' }, { status: 400 });
    }

    let templateData: Record<string, any> = {
      user_id: userId,
      name,
      description: description || null,
      category: category || 'general',
      default_tone: defaultTone || 'professional',
      default_length: defaultLength || 'standard',
    };

    // If creating from existing cover letter
    if (coverLetterId) {
      const { data: coverLetter } = await supabase
        .from('cover_letters')
        .select('content_sections, tone_setting, length_setting')
        .eq('id', coverLetterId)
        .eq('user_id', userId)
        .single();

      if (coverLetter?.content_sections) {
        const sections = coverLetter.content_sections;
        templateData.opening_template = sections.opening?.content || '';
        templateData.body_template = sections.body?.map((b: any) => b.content).join('\n\n') || '';
        templateData.closing_template = sections.closing?.content || '';
        templateData.default_tone = coverLetter.tone_setting;
        templateData.default_length = coverLetter.length_setting;
      }
    } else {
      // Use provided template content
      templateData.opening_template = openingTemplate || '';
      templateData.body_template = bodyTemplate || '';
      templateData.closing_template = closingTemplate || '';
    }

    const { data, error } = await supabase
      .from('cover_letter_templates')
      .insert(templateData)
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      template: data,
    });

  } catch (error) {
    console.error('Error in POST template:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// ============================================================
// PUT - Update user template
// ============================================================

export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const body = await request.json();
    const { templateId, ...updates } = body;

    if (!templateId) {
      return NextResponse.json({ error: 'Template ID required' }, { status: 400 });
    }

    // Verify ownership (can't edit system templates)
    const { data: existing } = await supabase
      .from('cover_letter_templates')
      .select('id, user_id')
      .eq('id', templateId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (!existing.user_id || existing.user_id !== userId) {
      return NextResponse.json({ error: 'Cannot edit system templates' }, { status: 403 });
    }

    // Allowed fields to update
    const allowedFields = [
      'name',
      'description',
      'category',
      'opening_template',
      'body_template',
      'closing_template',
      'default_tone',
      'default_length',
      'is_active',
    ];

    const sanitizedUpdates: Record<string, any> = {};
    for (const key of allowedFields) {
      if (key in updates) {
        sanitizedUpdates[key] = updates[key];
      }
    }

    const { data, error } = await supabase
      .from('cover_letter_templates')
      .update(sanitizedUpdates)
      .eq('id', templateId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating template:', error);
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      template: data,
    });

  } catch (error) {
    console.error('Error in PUT template:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// ============================================================
// DELETE - Delete user template
// ============================================================

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const supabase = createSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');

    if (!templateId) {
      return NextResponse.json({ error: 'Template ID required' }, { status: 400 });
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('cover_letter_templates')
      .select('id, user_id')
      .eq('id', templateId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (!existing.user_id || existing.user_id !== userId) {
      return NextResponse.json({ error: 'Cannot delete system templates' }, { status: 403 });
    }

    const { error } = await supabase
      .from('cover_letter_templates')
      .delete()
      .eq('id', templateId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting template:', error);
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Template deleted',
    });

  } catch (error) {
    console.error('Error in DELETE template:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
