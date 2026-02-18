// Application Tailored Resume Draft API
// src/app/api/applications/[id]/tailored-draft/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';
import type { StructuredResumeContent } from '@/types/tailored-resume';

export const runtime = 'nodejs';

function buildResumeText(content: StructuredResumeContent): string {
  const parts: string[] = [];

  if (content.summary?.content) {
    parts.push('SUMMARY');
    parts.push(content.summary.content);
    parts.push('');
  }

  if (content.experience?.jobs?.length) {
    parts.push('EXPERIENCE');
    content.experience.jobs.forEach((job) => {
      const roleLine = [
        job.title,
        job.company,
        job.location ? `(${job.location})` : '',
      ]
        .filter(Boolean)
        .join(' ');
      parts.push(roleLine);
      parts.push(`${job.startDate} - ${job.current ? 'Present' : job.endDate || 'Present'}`);
      job.bullets?.forEach((bullet) => {
        parts.push(`- ${bullet.content}`);
      });
      parts.push('');
    });
  }

  if (content.skills?.groups?.length) {
    parts.push('SKILLS');
    content.skills.groups.forEach((group) => {
      parts.push(`${group.category}: ${group.skills.join(', ')}`);
    });
    parts.push('');
  }

  if (content.education?.entries?.length) {
    parts.push('EDUCATION');
    content.education.entries.forEach((entry) => {
      parts.push(
        [entry.degree, entry.institution, entry.location ? `(${entry.location})` : '']
          .filter(Boolean)
          .join(' ')
      );
      if (entry.graduationDate) parts.push(entry.graduationDate);
      if (entry.honors?.length) parts.push(`Honors: ${entry.honors.join(', ')}`);
      parts.push('');
    });
  }

  if (content.certifications?.entries?.length) {
    parts.push('CERTIFICATIONS');
    content.certifications.entries.forEach((entry) => {
      parts.push([entry.name, entry.issuer].filter(Boolean).join(' - '));
    });
    parts.push('');
  }

  if (content.projects?.entries?.length) {
    parts.push('PROJECTS');
    content.projects.entries.forEach((entry) => {
      parts.push(entry.name);
      if (entry.description) parts.push(entry.description);
      entry.bullets?.forEach((bullet) => {
        parts.push(`- ${bullet.content}`);
      });
      parts.push('');
    });
  }

  if (content.other?.length) {
    content.other.forEach((section) => {
      parts.push(section.sectionTitle.toUpperCase());
      parts.push(section.content);
      parts.push('');
    });
  }

  return parts.join('\n').trim();
}

function applyAcceptedChanges(baseText: string, changes: any[]): string {
  let updated = baseText;
  const safeReplaceOnce = (text: string, target: string, replacement: string) => {
    if (!target || !replacement) return text;
    const idx = text.indexOf(target);
    if (idx === -1) return text;
    return text.slice(0, idx) + replacement + text.slice(idx + target.length);
  };

  changes.forEach((change) => {
    const status = change?.status ?? 'accepted';
    if (status !== 'accepted') return;
    const original = String(change?.original || '').trim();
    const tailored = String(change?.tailored || '').trim();
    if (!original || !tailored) return;

    let next = safeReplaceOnce(updated, original, tailored);
    if (next === updated) {
      // Try bullet variant match
      next = safeReplaceOnce(updated, `- ${original}`, `- ${tailored}`);
    }
    updated = next;
  });

  return updated;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: applicationId } = await params;
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) return Errors.unauthorized();

    const supabase = createSupabaseAdmin();

    const { data: existing, error } = await supabase
      .from('application_tailored_drafts')
      .select('*')
      .eq('application_id', applicationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      return Errors.databaseError(error.message);
    }

    if (existing) {
      return NextResponse.json({ success: true, draft: existing });
    }

    // No draft yet — seed from tailored resume if linked
    const { data: appRow } = await supabase
      .from('applications')
      .select('id, tailored_resume_id')
      .eq('id', applicationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!appRow?.tailored_resume_id) {
      return NextResponse.json({ success: true, draft: null });
    }

    const { data: trRow } = await supabase
      .from('tailored_resumes')
      .select('id, tailored_content, original_content, changes, master_resume_id')
      .eq('id', appRow.tailored_resume_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!trRow) {
      return NextResponse.json({ success: true, draft: null });
    }

    let baseText = '';
    if (trRow.master_resume_id) {
      const { data: master } = await supabase
        .from('user_documents')
        .select('extracted_text')
        .eq('id', trRow.master_resume_id)
        .eq('user_id', userId)
        .maybeSingle();
      baseText = String(master?.extracted_text || '');
    }

    if (!baseText && trRow.original_content) {
      baseText = buildResumeText(trRow.original_content as StructuredResumeContent);
    }

    if (!baseText && trRow.tailored_content) {
      baseText = buildResumeText(trRow.tailored_content as StructuredResumeContent);
    }

    const changes = Array.isArray(trRow.changes) ? trRow.changes : [];
    const draftText = applyAcceptedChanges(baseText, changes);

    return NextResponse.json({
      success: true,
      draft: {
        application_id: applicationId,
        tailored_resume_id: trRow.id,
        draft_content: draftText,
        draft_version: 1,
      }
    });
  } catch (error: any) {
    console.error('[Application draft GET]:', error?.message);
    return Errors.internal();
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: applicationId } = await params;
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) return Errors.unauthorized();

    const body = await req.json();
    const draftContent = String(body?.draft_content || '').trim();
    if (!draftContent) return Errors.validationError('draft_content required');

    const supabase = createSupabaseAdmin();
    const payload = {
      application_id: applicationId,
      user_id: userId,
      tailored_resume_id: body?.tailored_resume_id ?? null,
      draft_content: draftContent,
      draft_version: body?.draft_version ?? 1,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('application_tailored_drafts')
      .upsert(payload, { onConflict: 'application_id' })
      .select('*')
      .single();

    if (error) return Errors.databaseError(error.message);

    return NextResponse.json({ success: true, draft: data });
  } catch (error: any) {
    console.error('[Application draft POST]:', error?.message);
    return Errors.internal();
  }
}
