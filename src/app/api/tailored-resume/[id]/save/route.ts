// Save Tailored Resume to User Documents
// src/app/api/tailored-resume/[id]/save/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';
import type { TailoredResumeDB, StructuredResumeContent, ResumeChange } from '@/types/tailored-resume';

export async function POST(
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
    const { customName, setAsMaster } = body as {
      customName?: string;
      setAsMaster?: boolean
    };

    // Fetch the tailored resume - verify ownership
    const { data: tailoredResume, error: fetchError } = await supabase
      .from('tailored_resumes')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !tailoredResume) {
      console.error('💾 Fetch error:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Tailored resume not found' },
        { status: 404 }
      );
    }

    const tr = tailoredResume as TailoredResumeDB;

    // Get job details for naming
    const { data: job } = await supabase
      .from('job_analyses')
      .select('job_title, company_name')
      .eq('id', tr.job_analysis_id)
      .single();

    // Apply accepted changes to get final content
    const acceptedChanges = (tr.changes || []).filter(
      (change: ResumeChange) => change.status === 'accepted'
    );

    const finalContent = applyChangesToContent(
      tr.original_content || {},
      acceptedChanges
    );

    // Generate extracted text from structured content
    const extractedText = generateTextFromStructured(finalContent);

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const jobTitle = job?.job_title || 'Position';
    const company = job?.company_name || 'Company';
    const fileName = customName || 
      `Tailored - ${jobTitle} at ${company} - ${timestamp}.docx`;

    console.log('💾 Creating new resume document:', fileName);

    // Create new user_documents record
    const { data: savedResume, error: saveError } = await supabase
      .from('user_documents')
      .insert({
        user_id: tr.user_id,
        file_name: fileName,
        file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        file_size: extractedText.length,
        extracted_text: extractedText,
        analysis_summary: JSON.stringify({
          source: 'tailored_resume',
          tailored_resume_id: id,
          job_id: tr.job_analysis_id,
          changes_applied: acceptedChanges.length,
          tailoring_level: tr.tailoring_level,
          created_from: 'conversation'
        }),
        is_master_resume: setAsMaster || false,
        is_active: true,
        upload_source: 'tailored_conversation',
        source: 'tailored',
        title: `${jobTitle} Resume`,
        target_role: jobTitle,
        is_draft: false
      })
      .select()
      .single();

    if (saveError) {
      console.error('💾 Save error:', saveError);
      return NextResponse.json(
        { success: false, error: 'Failed to save resume', details: saveError.message },
        { status: 500 }
      );
    }

    console.log('✅ Saved as new resume:', savedResume.id);

    // Update the tailored_resumes record to mark it as saved
    await supabase
      .from('tailored_resumes')
      .update({
        is_finalized: true,
        finalized_at: new Date().toISOString()
      })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      message: 'Resume saved successfully',
      resumeId: savedResume.id,
      fileName: fileName
    });

  } catch (error) {
    console.error('💾 Unexpected error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to save resume', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Apply changes to content
function applyChangesToContent(
  original: StructuredResumeContent,
  changes: ResumeChange[]
): StructuredResumeContent {
  const result = JSON.parse(JSON.stringify(original)) as StructuredResumeContent;

  changes.forEach(change => {
    switch (change.section) {
      case 'summary':
        if (result.summary) {
          result.summary.content = change.tailored;
        }
        break;

      case 'experience':
        if (result.experience && change.subsection) {
          const match = change.subsection.match(/job-(\d+)-bullet-(\d+)/);
          if (match) {
            const jobIndex = parseInt(match[1]);
            const bulletIndex = parseInt(match[2]);
            if (result.experience.jobs?.[jobIndex]?.bullets?.[bulletIndex]) {
              result.experience.jobs[jobIndex].bullets[bulletIndex].content = change.tailored;
            }
          }
        }
        break;

      case 'skills':
        if (result.skills && change.subsection) {
          const match = change.subsection.match(/group-(\d+)/);
          if (match) {
            const groupIndex = parseInt(match[1]);
            if (result.skills.groups?.[groupIndex]) {
              result.skills.groups[groupIndex].skills = change.tailored.split(',').map(s => s.trim());
            }
          }
        }
        break;
    }
  });

  return result;
}

// Generate text from structured content
function generateTextFromStructured(content: StructuredResumeContent): string {
  const sections: string[] = [];

  // Contact Info
  if (content.contactInfo) {
    sections.push(content.contactInfo.name || '');
    const contact = [
      content.contactInfo.location,
      content.contactInfo.email,
      content.contactInfo.phone
    ].filter(Boolean).join(' | ');
    if (contact) sections.push(contact);
    if (content.contactInfo.linkedin) sections.push(content.contactInfo.linkedin);
  }

  sections.push(''); // Blank line

  // Summary
  if (content.summary?.content) {
    sections.push('PROFESSIONAL SUMMARY');
    sections.push('');
    sections.push(content.summary.content);
    sections.push('');
  }

  // Skills
  if (content.skills?.groups && content.skills.groups.length > 0) {
    sections.push('SKILLS');
    sections.push('');
    content.skills.groups.forEach(group => {
      if (group.skills && group.skills.length > 0) {
        sections.push(`${group.category}: ${group.skills.join(', ')}`);
      }
    });
    sections.push('');
  }

  // Experience
  if (content.experience?.jobs && content.experience.jobs.length > 0) {
    sections.push('PROFESSIONAL EXPERIENCE');
    sections.push('');
    content.experience.jobs.forEach(job => {
      sections.push(`${job.title || 'Position'} - ${job.company || 'Company'}`);
      const dates = job.startDate + (job.endDate ? ` - ${job.endDate}` : ' - Present');
      sections.push(`${dates}${job.location ? ' | ' + job.location : ''}`);
      sections.push('');
      if (job.bullets && job.bullets.length > 0) {
        job.bullets.forEach(bullet => {
          if (bullet.content) {
            sections.push(`• ${bullet.content}`);
          }
        });
      }
      sections.push('');
    });
  }

  // Education
  if (content.education?.entries && content.education.entries.length > 0) {
    sections.push('EDUCATION');
    sections.push('');
    content.education.entries.forEach(entry => {
      sections.push(entry.degree || 'Degree');
      const eduDetails = [entry.institution, entry.location, entry.graduationDate]
        .filter(Boolean).join(' | ');
      if (eduDetails) sections.push(eduDetails);
      if (entry.gpa) sections.push(`GPA: ${entry.gpa}`);
      sections.push('');
    });
  }

  // Certifications
  if (content.certifications?.entries && content.certifications.entries.length > 0) {
    sections.push('CERTIFICATIONS');
    sections.push('');
    content.certifications.entries.forEach(cert => {
      const certLine = [
        cert.name,
        cert.issuer,
        cert.date ? `(${cert.date})` : null
      ].filter(Boolean).join(' - ');
      sections.push(certLine);
    });
    sections.push('');
  }

  return sections.join('\n');
}