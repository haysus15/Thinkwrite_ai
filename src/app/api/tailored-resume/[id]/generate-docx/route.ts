// Generate DOCX from Tailored Resume
// src/app/api/tailored-resume/[id]/generate-docx/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createSupabaseAdmin } from '@/lib/auth/getAuthUser';
import { Errors } from '@/lib/api/errors';
import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle } from 'docx';
import type {
  TailoredResumeDB,
  StructuredResumeContent,
  ResumeChange
} from '@/types/tailored-resume';

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

    let body = {};
    try {
      body = await request.json();
    } catch {
      // Body might be empty, that's ok
    }
    const { includeRejectedChanges = false } = body as { includeRejectedChanges?: boolean };

    // Fetch the tailored resume - verify ownership
    const { data: tailoredResume, error: fetchError } = await supabase
      .from('tailored_resumes')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('📄 Generate DOCX: Fetch error:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Tailored resume not found', details: fetchError.message },
        { status: 404 }
      );
    }

    if (!tailoredResume) {
      console.error('📄 Generate DOCX: No data returned');
      return NextResponse.json(
        { success: false, error: 'Tailored resume not found' },
        { status: 404 }
      );
    }

    console.log('📄 Generate DOCX: Found tailored resume');
    const tr = tailoredResume as TailoredResumeDB;

    // Get the changes to apply
    const changesToApply = (tr.changes || []).filter((change: ResumeChange) => {
      if (includeRejectedChanges) {
        return change.status !== 'rejected';
      }
      return change.status === 'accepted';
    });

    console.log(`📄 Generate DOCX: Applying ${changesToApply.length} changes`);

    // Apply changes to get final content
    const finalContent = applyChangesToContent(
      tr.original_content || {},
      changesToApply
    );

    console.log('📄 Generate DOCX: Generating document...');
    
    // Generate DOCX
    const doc = generateDocxFromContent(finalContent);
    const buffer = await Packer.toBuffer(doc);

    console.log('📄 Generate DOCX: Document generated, size:', buffer.length);

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `tailored-resume-${timestamp}-v${tr.version_number || 1}.docx`;

    // Update the tailored resume record
    try {
      await supabase
        .from('tailored_resumes')
        .update({
          file_generated_at: new Date().toISOString()
        })
        .eq('id', id);
    } catch (updateError) {
      console.warn('📄 Generate DOCX: Failed to update record:', updateError);
      // Continue anyway - not critical
    }

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(buffer);

    console.log('📄 Generate DOCX: Returning file:', fileName);

    // Return the file as a download
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length.toString()
      }
    });

  } catch (error) {
    console.error('📄 Generate DOCX: Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate document', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Apply accepted changes to original content
function applyChangesToContent(
  original: StructuredResumeContent,
  changes: ResumeChange[]
): StructuredResumeContent {
  // Deep clone the original
  const result = JSON.parse(JSON.stringify(original)) as StructuredResumeContent;

  // Apply each change
  changes.forEach(change => {
    applyChangeToContent(result, change);
  });

  return result;
}

// Apply a single change to the content
function applyChangeToContent(content: StructuredResumeContent, change: ResumeChange) {
  switch (change.section) {
    case 'summary':
      if (content.summary) {
        content.summary.content = change.tailored;
      }
      break;

    case 'experience':
      if (content.experience && change.subsection) {
        // Parse subsection like "job-0-bullet-1"
        const match = change.subsection.match(/job-(\d+)-bullet-(\d+)/);
        if (match) {
          const jobIndex = parseInt(match[1]);
          const bulletIndex = parseInt(match[2]);
          if (content.experience.jobs?.[jobIndex]?.bullets?.[bulletIndex]) {
            content.experience.jobs[jobIndex].bullets[bulletIndex].content = change.tailored;
          }
        }
        // Handle job title changes
        const titleMatch = change.subsection.match(/job-(\d+)-title/);
        if (titleMatch) {
          const jobIndex = parseInt(titleMatch[1]);
          if (content.experience.jobs?.[jobIndex]) {
            content.experience.jobs[jobIndex].title = change.tailored;
          }
        }
      }
      break;

    case 'skills':
      if (content.skills && change.subsection) {
        // Parse subsection like "group-0"
        const match = change.subsection.match(/group-(\d+)/);
        if (match) {
          const groupIndex = parseInt(match[1]);
          if (content.skills.groups?.[groupIndex]) {
            // Replace the entire skills array for this group
            content.skills.groups[groupIndex].skills = change.tailored.split(',').map(s => s.trim());
          }
        }
      }
      break;

    case 'projects':
      if (content.projects && change.subsection) {
        const match = change.subsection.match(/project-(\d+)(?:-bullet-(\d+))?/);
        if (match) {
          const projectIndex = parseInt(match[1]);
          const bulletIndex = match[2] ? parseInt(match[2]) : null;
          
          if (bulletIndex !== null && content.projects.entries?.[projectIndex]?.bullets?.[bulletIndex]) {
            content.projects.entries[projectIndex].bullets![bulletIndex].content = change.tailored;
          } else if (content.projects.entries?.[projectIndex]) {
            content.projects.entries[projectIndex].description = change.tailored;
          }
        }
      }
      break;

    default:
      // Handle other sections as needed
      break;
  }
}

// Generate DOCX document from structured content
function generateDocxFromContent(content: StructuredResumeContent): Document {
  const sections: Paragraph[] = [];

  // Contact Info Header
  if (content.contactInfo) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: content.contactInfo.name || 'Your Name',
            bold: true,
            size: 32 // 16pt
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 }
      })
    );

    const contactLine = [
      content.contactInfo.email,
      content.contactInfo.phone,
      content.contactInfo.location
    ].filter(Boolean).join(' | ');

    if (contactLine) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: contactLine,
              size: 20 // 10pt
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 }
        })
      );
    }

    const linksLine = [
      content.contactInfo.linkedin,
      content.contactInfo.website
    ].filter(Boolean).join(' | ');

    if (linksLine) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: linksLine,
              size: 20
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        })
      );
    }
  }

  // Professional Summary
  if (content.summary?.content) {
    sections.push(createSectionHeader('PROFESSIONAL SUMMARY'));
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: content.summary.content,
            size: 22 // 11pt
          })
        ],
        spacing: { after: 200 }
      })
    );
  }

  // Professional Experience
  if (content.experience?.jobs && content.experience.jobs.length > 0) {
    sections.push(createSectionHeader('PROFESSIONAL EXPERIENCE'));

    content.experience.jobs.forEach(job => {
      // Job title and company
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: job.title || 'Position',
              bold: true,
              size: 22
            }),
            new TextRun({
              text: ` | ${job.company || 'Company'}`,
              size: 22
            })
          ],
          spacing: { before: 150, after: 50 }
        })
      );

      // Dates and location
      const dateLocation = [
        (job.startDate || '') + (job.endDate ? ` - ${job.endDate}` : ' - Present'),
        job.location
      ].filter(Boolean).join(' | ');

      if (dateLocation && dateLocation !== ' - Present') {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: dateLocation,
                italics: true,
                size: 20
              })
            ],
            spacing: { after: 100 }
          })
        );
      }

      // Bullets
      if (job.bullets && job.bullets.length > 0) {
        job.bullets.forEach(bullet => {
          if (bullet.content) {
            sections.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `• ${bullet.content}`,
                    size: 22
                  })
                ],
                indent: { left: 360 }, // 0.25 inch
                spacing: { after: 50 }
              })
            );
          }
        });
      }
    });
  }

  // Skills
  if (content.skills?.groups && content.skills.groups.length > 0) {
    sections.push(createSectionHeader('SKILLS'));

    content.skills.groups.forEach(group => {
      if (group.skills && group.skills.length > 0) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${group.category || 'Skills'}: `,
                bold: true,
                size: 22
              }),
              new TextRun({
                text: group.skills.join(', '),
                size: 22
              })
            ],
            spacing: { after: 50 }
          })
        );
      }
    });
  }

  // Education
  if (content.education?.entries && content.education.entries.length > 0) {
    sections.push(createSectionHeader('EDUCATION'));

    content.education.entries.forEach(entry => {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: entry.degree || 'Degree',
              bold: true,
              size: 22
            })
          ],
          spacing: { before: 100, after: 50 }
        })
      );

      const eduDetails = [
        entry.institution,
        entry.location,
        entry.graduationDate
      ].filter(Boolean).join(' | ');

      if (eduDetails) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: eduDetails,
                size: 22
              })
            ],
            spacing: { after: 50 }
          })
        );
      }

      if (entry.gpa) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `GPA: ${entry.gpa}`,
                size: 20
              })
            ],
            spacing: { after: 50 }
          })
        );
      }

      if (entry.honors && entry.honors.length > 0) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Honors: ${entry.honors.join(', ')}`,
                size: 20
              })
            ],
            spacing: { after: 50 }
          })
        );
      }
    });
  }

  // Certifications
  if (content.certifications?.entries && content.certifications.entries.length > 0) {
    sections.push(createSectionHeader('CERTIFICATIONS'));

    content.certifications.entries.forEach(cert => {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: cert.name || 'Certification',
              bold: true,
              size: 22
            }),
            new TextRun({
              text: cert.issuer ? ` - ${cert.issuer}` : '',
              size: 22
            }),
            ...(cert.date ? [new TextRun({
              text: ` (${cert.date})`,
              italics: true,
              size: 20
            })] : [])
          ],
          spacing: { after: 50 }
        })
      );
    });
  }

  // Projects
  if (content.projects?.entries && content.projects.entries.length > 0) {
    sections.push(createSectionHeader('PROJECTS'));

    content.projects.entries.forEach(project => {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: project.name || 'Project',
              bold: true,
              size: 22
            }),
            ...(project.technologies && project.technologies.length > 0 ? [new TextRun({
              text: ` (${project.technologies.join(', ')})`,
              italics: true,
              size: 20
            })] : [])
          ],
          spacing: { before: 100, after: 50 }
        })
      );

      if (project.description) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: project.description,
                size: 22
              })
            ],
            spacing: { after: 50 }
          })
        );
      }

      if (project.bullets && project.bullets.length > 0) {
        project.bullets.forEach(bullet => {
          if (bullet.content) {
            sections.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `• ${bullet.content}`,
                    size: 22
                  })
                ],
                indent: { left: 360 },
                spacing: { after: 50 }
              })
            );
          }
        });
      }
    });
  }

  // If no content at all, add a placeholder
  if (sections.length === 0) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Tailored Resume',
            bold: true,
            size: 28
          })
        ],
        alignment: AlignmentType.CENTER
      })
    );
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'No content available. Please check that changes were properly applied.',
            size: 22
          })
        ],
        spacing: { before: 200 }
      })
    );
  }

  return new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 720,    // 0.5 inch
            right: 720,
            bottom: 720,
            left: 720
          }
        }
      },
      children: sections
    }]
  });
}

// Helper to create section headers
function createSectionHeader(title: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 24, // 12pt
        allCaps: true
      })
    ],
    border: {
      bottom: {
        color: '000000',
        space: 1,
        style: BorderStyle.SINGLE,
        size: 6
      }
    },
    spacing: { before: 300, after: 100 }
  });
}