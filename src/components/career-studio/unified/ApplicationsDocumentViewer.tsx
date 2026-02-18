// Applications Document Viewer - Right Panel (Read Only)
// src/components/career-studio/unified/ApplicationsDocumentViewer.tsx

'use client';

import { useEffect, useState } from 'react';
import { dispatchLexPrompt } from '@/lib/career-studio/lexBus';
import { dispatchApplicationScore } from '@/lib/career-studio/applicationBus';
import type { StructuredResumeContent } from '@/types/tailored-resume';

export type ApplicationViewerType = 'job-analysis' | 'tailored-resume' | 'cover-letter';

export interface ApplicationViewerPayload {
  type: ApplicationViewerType;
  title?: string;
  company?: string;
  data: any;
}

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

export default function ApplicationsDocumentViewer({
  payload,
  onClose,
}: {
  payload: ApplicationViewerPayload;
  onClose: () => void;
}) {
  const { type, title, company, data } = payload;
  const [tailoredLoading, setTailoredLoading] = useState(false);
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [jobLoading, setJobLoading] = useState(false);
  const [tailoredText, setTailoredText] = useState<string | null>(null);
  const [tailoredDraftText, setTailoredDraftText] = useState<string | null>(null);
  const [tailoredDraftDirty, setTailoredDraftDirty] = useState(false);
  const [tailoredDraftSaving, setTailoredDraftSaving] = useState(false);
  const [coverLetterTextOverride, setCoverLetterTextOverride] = useState<string | null>(null);
  const [jobDescriptionOverride, setJobDescriptionOverride] = useState<string | null>(null);
  const [requirementsOverride, setRequirementsOverride] = useState<string[] | null>(null);
  const [responsibilitiesOverride, setResponsibilitiesOverride] = useState<string[] | null>(null);

  useEffect(() => {
    let active = true;
    if (type !== 'tailored-resume' || !data?.tailored_resume_id) return;
    setTailoredLoading(true);
    (async () => {
      try {
        const draftRes = await fetch(`/api/applications/${data.id}/tailored-draft`);
        const draftJson = await draftRes.json();
        if (!active) return;
        if (draftJson?.success && draftJson?.draft?.draft_content) {
          setTailoredDraftText(draftJson.draft.draft_content);
          setTailoredDraftDirty(false);
        }

        const res = await fetch(`/api/tailored-resume/${data.tailored_resume_id}`);
        const json = await res.json();
        if (!active) return;
        if (json?.success && json?.tailoredResume?.tailoredContent) {
          setTailoredText(buildResumeText(json.tailoredResume.tailoredContent));
        } else {
          setTailoredText(null);
        }
      } catch (err) {
        if (!active) return;
        setTailoredText(null);
        setTailoredDraftText(null);
      } finally {
        if (!active) return;
        setTailoredLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [type, data?.tailored_resume_id, data?.id]);

  useEffect(() => {
    let active = true;
    if (type !== 'cover-letter' || !data?.cover_letter_id) return;
    setCoverLetterLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/cover-letter/${data.cover_letter_id}`);
        const json = await res.json();
        if (!active) return;
        if (json?.success && json?.coverLetter?.content) {
          setCoverLetterTextOverride(json.coverLetter.content);
        }
      } catch (err) {
        if (!active) return;
        setCoverLetterTextOverride(null);
      } finally {
        if (!active) return;
        setCoverLetterLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [type, data?.cover_letter_id]);

  useEffect(() => {
    let active = true;
    if (type !== 'job-analysis' || !data?.job_analysis_id) return;
    setJobLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/job-analysis/${data.job_analysis_id}`);
        const json = await res.json();
        if (!active) return;
        if (json?.success && json?.analysis) {
          setJobDescriptionOverride(
            json.analysis?.job_description ||
              json.analysis?.job_description_text ||
              json.analysis?.source_content ||
              null
          );
          setRequirementsOverride(Array.isArray(json.analysis?.requirements) ? json.analysis.requirements : null);
          setResponsibilitiesOverride(
            Array.isArray(json.analysis?.responsibilities) ? json.analysis.responsibilities : null
          );
        }
      } catch (err) {
        if (!active) return;
        setJobDescriptionOverride(null);
        setRequirementsOverride(null);
        setResponsibilitiesOverride(null);
      } finally {
        if (!active) return;
        setJobLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [type, data?.job_analysis_id]);

  const jobDescription =
    jobDescriptionOverride ||
    data?.job_description ||
    data?.source_content ||
    data?.job_description_text ||
    'No job description available.';
  const requirements =
    requirementsOverride ||
    (Array.isArray(data?.requirements) ? data.requirements : []);
  const responsibilities =
    responsibilitiesOverride ||
    (Array.isArray(data?.responsibilities) ? data.responsibilities : []);

  const coverLetterText =
    coverLetterTextOverride ||
    data?.cover_letter_content ||
    data?.cover_letter_html ||
    'No cover letter saved for this application.';

  const tailoredContent = data?.resume_tailored_content as StructuredResumeContent | undefined;
  const originalContent = data?.resume_original_content as StructuredResumeContent | undefined;
  const resumeText = tailoredText ||
    (tailoredContent
      ? buildResumeText(tailoredContent)
      : originalContent
      ? buildResumeText(originalContent)
      : data?.source_content || 'No tailored resume content available.');

  const headerLabel =
    type === 'job-analysis' ? 'Job Analysis' : type === 'cover-letter' ? 'Cover Letter' : 'Tailored Resume';

  return (
    <section className="flex flex-col h-full">
      <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3 flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wider text-white/40">
            {headerLabel}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-white/50 hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="text-sm text-white/90 font-semibold">{title || 'Untitled'}</div>
        {company && <div className="text-xs text-white/50 mb-3">{company}</div>}

        <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3 text-[12px] leading-[1.6] text-white/90 whitespace-pre-wrap">
          {type === 'job-analysis' && (
            <div className="space-y-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-white/40 mb-2">Job Description</div>
                <div>{jobLoading ? 'Loading job description...' : jobDescription}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-white/40 mb-2">Requirements</div>
                {jobLoading ? (
                  <div className="text-white/50">Loading requirements…</div>
                ) : requirements.length ? (
                  <ul className="list-disc pl-4 space-y-1">
                    {requirements.map((req: string, idx: number) => (
                      <li key={`${req}-${idx}`}>{req}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-white/50">No requirements listed.</div>
                )}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-white/40 mb-2">Responsibilities</div>
                {jobLoading ? (
                  <div className="text-white/50">Loading responsibilities…</div>
                ) : responsibilities.length ? (
                  <ul className="list-disc pl-4 space-y-1">
                    {responsibilities.map((resp: string, idx: number) => (
                      <li key={`${resp}-${idx}`}>{resp}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-white/50">No responsibilities listed.</div>
                )}
              </div>
            </div>
          )}
          {type === 'cover-letter' && (
            <div>{coverLetterLoading ? 'Loading cover letter...' : coverLetterText}</div>
          )}
          {type === 'tailored-resume' && (
            <div className="space-y-3">
              {tailoredLoading ? (
                <div>Loading tailored resume...</div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-[11px] text-white/50">
                    <span>Application-specific draft</span>
                    {tailoredDraftDirty && <span className="text-white/40">Unsaved changes</span>}
                  </div>
                  <textarea
                    value={tailoredDraftText ?? resumeText}
                    onChange={(e) => {
                      setTailoredDraftText(e.target.value);
                      setTailoredDraftDirty(true);
                    }}
                    className="w-full min-h-[420px] rounded-lg border border-white/10 bg-black/20 p-3 text-[12px] leading-[1.6] text-white/90 focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!data?.id) return;
                        setTailoredDraftSaving(true);
                        try {
                          const res = await fetch(`/api/applications/${data.id}/tailored-draft`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              tailored_resume_id: data?.tailored_resume_id ?? null,
                              draft_content: tailoredDraftText ?? resumeText,
                              draft_version: 1,
                            }),
                          });
                          const json = await res.json();
                          if (json?.success) {
                            setTailoredDraftDirty(false);
                          }
                        } finally {
                          setTailoredDraftSaving(false);
                        }
                      }}
                      className="career-btn-primary px-3 py-1.5 text-xs rounded-md"
                    >
                      {tailoredDraftSaving ? 'Saving...' : 'Save Draft'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTailoredDraftText(resumeText);
                        setTailoredDraftDirty(false);
                      }}
                      className="career-btn-ghost px-3 py-1.5 text-xs rounded-md"
                    >
                      Reset
                    </button>
                    <span className="text-[11px] text-white/50">
                      Use Run final check in the middle panel to refresh the application score.
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
