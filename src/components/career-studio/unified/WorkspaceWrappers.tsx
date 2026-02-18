// Workspace Wrappers - Thin wrappers for existing components
// src/components/career-studio/unified/WorkspaceWrappers.tsx
// CRITICAL: These are THIN wrappers - just pass props to existing components!

'use client';

import { WorkspaceContext, WorkspaceView } from '@/types/career-studio-workspace';
import { getWorkspaceConfig } from '@/lib/career-studio/workspaceManager';
import { ChevronLeft, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { dispatchLexPrompt, subscribeToStrategySummary } from '@/lib/career-studio/lexBus';
import { subscribeToApplicationScore } from '@/lib/career-studio/applicationBus';

// Import existing components
import JobAnalysisInterface from '../job-analysis/JobAnalysisInterface';
import TailorResumeInterface from '../tailor-resume/TailorResumeInterface';
import CoverLetterGenerator from '../cover-letter/CoverLetterGenerator';
import CareerAssessmentInterface from '../assessment/CareerAssessmentInterface';
import ResumeManager from '../resume-manager/ResumeManager';
import ResumeBuilderInterface from '../resume-builder/ResumeBuilderInterface';

// Common props for all workspace wrappers
interface WorkspaceWrapperProps {
  workspaceContext: WorkspaceContext;
  onNavigate: (view: WorkspaceView, context?: Partial<WorkspaceContext>) => void;
  onContextUpdate: (context: Partial<WorkspaceContext>) => void;
  workspaceView: WorkspaceView;
  onOpenLex?: () => void;
  onOpenApplicationViewer?: (payload: any) => void;
  lexCollapsed?: boolean;
}

function WorkspaceHeader({
  workspaceView,
  onNavigate
}: Pick<WorkspaceWrapperProps, 'workspaceView' | 'onNavigate'>) {
  const config = getWorkspaceConfig(workspaceView);

  if (workspaceView === 'dashboard') {
    return null;
  }

  return (
    <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-white/5">
      <button
        onClick={() => onNavigate('dashboard')}
        className="inline-flex items-center gap-2 text-[11px] text-[#C084FC] hover:text-white transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Career Dashboard
      </button>
      <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">
        {config.title}
      </div>
    </div>
  );
}

// ============================================================================
// JOB ANALYSIS WORKSPACE
// ============================================================================
export function JobAnalysisWorkspace({ workspaceContext, workspaceView, onNavigate }: WorkspaceWrapperProps) {
  return (
    <div className="h-full overflow-auto">
      <WorkspaceHeader workspaceView={workspaceView} onNavigate={onNavigate} />
      <JobAnalysisInterface />
    </div>
  );
}

// ============================================================================
// TAILORING WORKSPACE
// ============================================================================
export function TailoringWorkspace({
  workspaceContext,
  workspaceView,
  onNavigate,
  onOpenLex,
}: WorkspaceWrapperProps) {
  return (
    <div className="h-full overflow-auto">
      <WorkspaceHeader workspaceView={workspaceView} onNavigate={onNavigate} />
      <TailorResumeInterface
        jobAnalysisId={workspaceContext.selectedJobId}
        masterResumeId={workspaceContext.selectedResumeId}
        onOpenLex={onOpenLex}
      />
    </div>
  );
}

// ============================================================================
// COVER LETTER WORKSPACE
// ============================================================================
export function CoverLetterWorkspace({
  workspaceContext,
  workspaceView,
  onNavigate,
  onOpenLex,
}: WorkspaceWrapperProps) {
  return (
    <div className="h-full overflow-auto">
      <WorkspaceHeader workspaceView={workspaceView} onNavigate={onNavigate} />
      <CoverLetterGenerator
        resumeId={workspaceContext.selectedResumeId}
        jobAnalysisId={workspaceContext.selectedJobId}
        onOpenLex={onOpenLex}
      />
    </div>
  );
}

// ============================================================================
// ASSESSMENT WORKSPACE
// ============================================================================
export function AssessmentWorkspace({ workspaceContext, workspaceView, onNavigate, onOpenLex, lexCollapsed }: WorkspaceWrapperProps) {
  return (
    <div className="h-full overflow-auto">
      <WorkspaceHeader workspaceView={workspaceView} onNavigate={onNavigate} />
      <CareerAssessmentInterface
        // These props can be passed from API later if needed
        hasCompletedBefore={false}
        lastCompletedDate={undefined}
        variant="progress"
        currentPhase={workspaceContext.assessmentPhase}
        lexCollapsed={lexCollapsed}
        onOpenLex={onOpenLex}
      />
    </div>
  );
}

// ============================================================================
// RESUME MANAGER WORKSPACE
// ============================================================================
export function ResumeManagerWorkspace({
  workspaceView,
  onNavigate,
  onContextUpdate,
}: WorkspaceWrapperProps) {
  return (
    <div className="h-full overflow-auto">
      <WorkspaceHeader workspaceView={workspaceView} onNavigate={onNavigate} />
      <ResumeManager onContextUpdate={onContextUpdate} />
    </div>
  );
}

// ============================================================================
// RESUME BUILDER WORKSPACE
// ============================================================================
export function ResumeBuilderWorkspace({ workspaceContext, workspaceView, onNavigate }: WorkspaceWrapperProps) {
  return (
    <div className="h-full overflow-auto">
      <WorkspaceHeader workspaceView={workspaceView} onNavigate={onNavigate} />
      <ResumeBuilderInterface
        resumeId={workspaceContext.selectedResumeId}
      />
    </div>
  );
}

// ============================================================================
// APPLICATIONS WORKSPACE
// ============================================================================
export function ApplicationsWorkspace({
  workspaceContext,
  workspaceView,
  onNavigate,
  onOpenApplicationViewer,
}: WorkspaceWrapperProps) {
  // Applications page has its own full implementation
  // We'll create a simplified inline version or redirect
  return (
    <div className="h-full overflow-auto">
      <WorkspaceHeader workspaceView={workspaceView} onNavigate={onNavigate} />
      <ApplicationsInlineView
        onNavigate={onNavigate}
        onOpenApplicationViewer={onOpenApplicationViewer}
      />
    </div>
  );
}

// Inline Applications View (simplified version for workspace)
function ApplicationsInlineView({
  onNavigate,
  onOpenApplicationViewer
}: {
  onNavigate: WorkspaceWrapperProps['onNavigate'];
  onOpenApplicationViewer?: (payload: any) => void;
}) {
  const [apps, setApps] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [scoreData, setScoreData] = React.useState<{
    score: {
      resumeScore: number;
      coverLetterScore: number;
      applicationScore: number;
      scoredAt?: string;
    };
    resumeAnalysis?: any;
    coverLetterBreakdown?: {
      overall?: number | null;
      voiceMatch?: number | null;
      jobAlignment?: number | null;
    };
  } | null>(null);
  const [lexReviewText, setLexReviewText] = React.useState<string | null>(null);
  const [showScoreSummary, setShowScoreSummary] = React.useState(true);
  const [showResumeBreakdown, setShowResumeBreakdown] = React.useState(false);
  const [showCoverBreakdown, setShowCoverBreakdown] = React.useState(false);
  const [showLexBreakdown, setShowLexBreakdown] = React.useState(false);
  const [showLexBlockers, setShowLexBlockers] = React.useState(true);
  const [showLexStrengths, setShowLexStrengths] = React.useState(true);
  const [showLexWeakSpots, setShowLexWeakSpots] = React.useState(true);
  const [showLexFixes, setShowLexFixes] = React.useState(true);
  const [rescoring, setRescoring] = React.useState(false);

  const parseFinalReview = React.useCallback((text?: string | null) => {
    if (!text) return null;
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.replace(/\*\*/g, '').replace(/__/g, '').trim());
    const result = {
      score: null as string | null,
      ready: null as string | null,
      blockers: [] as string[],
      strengths: [] as string[],
      weakSpots: [] as string[],
      fixes: [] as string[]
    };
    let section: 'blockers' | 'strengths' | 'weakSpots' | 'fixes' | null = null;
    for (const raw of lines) {
      if (!raw) continue;
      if (/^score:/i.test(raw)) {
        result.score = raw.replace(/^score:\s*/i, '');
        continue;
      }
      if (/^ready:/i.test(raw)) {
        result.ready = raw.replace(/^ready:\s*/i, '');
        continue;
      }
      if (/^blockers?:/i.test(raw)) {
        section = 'blockers';
        continue;
      }
      if (/^strengths?:/i.test(raw)) {
        section = 'strengths';
        continue;
      }
      if (/^weak spots?:/i.test(raw)) {
        section = 'weakSpots';
        continue;
      }
      if (/^fix before submitting:/i.test(raw)) {
        section = 'fixes';
        continue;
      }
      if (section) {
        const cleaned = raw.replace(/^[-•\d\.\)\s]+/, '').trim();
        if (cleaned) {
          result[section].push(cleaned);
        }
      }
    }
    return result;
  }, []);

  React.useEffect(() => {
    async function fetchApps() {
      try {
        const res = await fetch("/api/applications");
        const data = await res.json();
        if (data.success) {
          setApps(data.applications || []);
        }
      } catch (error) {
        console.error('Failed to load applications:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchApps();
  }, []);

  React.useEffect(() => {
    const unsubscribe = subscribeToStrategySummary((payload) => {
      if (payload.contextTag !== 'application-final-review') return;
      setLexReviewText(payload.text);
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  React.useEffect(() => {
    const unsubscribe = subscribeToApplicationScore((payload) => {
      if (!selectedId || payload.applicationId !== selectedId) return;
      setScoreData({
        score: payload.score,
        resumeAnalysis: payload.resumeAnalysis,
        coverLetterBreakdown: payload.coverLetterBreakdown
      });
    });
    return () => {
      unsubscribe?.();
    };
  }, [selectedId]);

  if (loading) {
    return (
      <div className="p-8 text-center text-white/40">
        Loading applications...
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-white/60 mb-4">No applications tracked yet.</p>
        <p className="text-white/40 text-sm">
          Analyze a job posting and save it to start tracking your applications.
        </p>
      </div>
    );
  }

  const normalizedApps = apps.map((app) => ({
    ...app,
    job_title: app.job_title || app.ja_job_title || app.cl_job_title || "Untitled role",
    company_name: app.company_name || app.company || app.ja_company_name || app.cl_company_name || "Unknown company",
    location: app.location || app.ja_location || null,
    status: app.status || app.cover_letter_status || "saved",
    has_job_analysis: Boolean(app.has_job_analysis || app.job_analysis_id),
    has_tailored_resume: Boolean(app.has_tailored_resume || app.tailored_resume_id),
    has_cover_letter: Boolean(app.has_cover_letter || app.cover_letter_id),
  }));

  const selectedApp = normalizedApps.find((app) => app.id === selectedId) || null;

  const readyMatch = lexReviewText?.match(/Ready:\s*(YES|NO)/i);
  const lexReady = readyMatch ? readyMatch[1].toUpperCase() : null;
  const numericScore = scoreData?.score?.applicationScore ?? null;
  const readyByScore = typeof numericScore === 'number' ? numericScore >= 90 : false;
  const finalReady = lexReady === 'NO' ? false : lexReady === 'YES' ? true : readyByScore;
  const parsedLexReview = parseFinalReview(lexReviewText);
  const completionCount = selectedApp
    ? [selectedApp.has_job_analysis, selectedApp.has_tailored_resume, selectedApp.has_cover_letter].filter(Boolean).length
    : 0;
  const completionPercent = Math.round((completionCount / 3) * 100);
  const scoreTone =
    typeof numericScore === 'number'
      ? numericScore >= 90
        ? 'from-emerald-400/25 to-emerald-500/10 border-emerald-300/30 text-emerald-100'
        : numericScore >= 75
        ? 'from-amber-400/25 to-amber-500/10 border-amber-300/30 text-amber-100'
        : 'from-rose-400/25 to-rose-500/10 border-rose-300/30 text-rose-100'
      : 'from-white/10 to-white/5 border-white/20 text-white/80';
  const readinessTone = finalReady
    ? 'border-emerald-300/35 bg-emerald-400/15 text-emerald-200'
    : 'border-amber-300/35 bg-amber-400/15 text-amber-100';

  const handleRescore = async () => {
    if (!selectedApp?.id) return;
    setRescoring(true);
    try {
      const res = await fetch(`/api/applications/${selectedApp.id}/score`, { method: 'POST' });
      const json = await res.json();
      if (json?.success) {
        setScoreData({
          score: json.score,
          resumeAnalysis: json.resumeAnalysis,
          coverLetterBreakdown: json.coverLetterBreakdown
        });
        dispatchLexPrompt({
          workspace: 'applications',
          resumeId: selectedApp?.tailored_resume_id,
          jobId: selectedApp?.job_analysis_id,
          intent: 'general',
          contextTag: 'application-final-review',
          displayPrompt: 'Lex is reviewing your full application…',
          prompt: [
            'You are Lex. This is a FINAL APPLICATION REVIEW.',
            `Application Score: ${json.score.applicationScore}/100`,
            `Resume Score: ${json.score.resumeScore}/100`,
            `Cover Letter Score: ${json.score.coverLetterScore}/100`,
            '',
            'Rules:',
            '- Minimum passing score is 90, but you can still block if critical clarification is needed.',
            '- Only block if a detail needs clarification or there is a risky claim.',
            '- Provide a clear Ready/Not Ready decision.',
            '',
            'Output format (EXACT):',
            'PANEL REVIEW:',
            'FINAL APPLICATION REVIEW',
            'Score: <number>/100',
            'Ready: YES | NO',
            'Blockers:',
            '- ...',
            'Strengths:',
            '- ...',
            'Weak spots:',
            '- ...',
            'Fix before submitting:',
            '- ...',
            '',
            'CHAT SUMMARY:',
            '<1-2 sentence summary>',
            'Fix before submitting:',
            '- ...',
            ].join('\n')
        });
      }
    } catch (error) {
      console.error('Failed to rescore application:', error);
    } finally {
      setRescoring(false);
    }
  };

  const updateApplication = async (id: string, update: Record<string, any>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...update }),
      });
      const data = await res.json();
      if (data?.success && data.application) {
        setApps((prev) =>
          prev.map((app) => (app.id === id ? { ...app, ...data.application } : app))
        );
      }
    } catch (error) {
      console.error("Failed to update application:", error);
    } finally {
      setSaving(false);
    }
  };

  const deleteApplication = async (id: string) => {
    const confirmed = window.confirm("Archive this application? You can restore it later if needed.");
    if (!confirmed) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/applications/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data?.success) {
        setApps((prev) => prev.filter((app) => app.id !== id));
        setSelectedId((prev) => (prev === id ? null : prev));
      }
    } catch (error) {
      console.error("Failed to delete application:", error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.02] to-transparent px-4 py-3">
        <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Application Workspace</div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <div className="text-sm text-white/85">Pipeline and final quality gate</div>
          <div className="text-xs text-white/55">
            {normalizedApps.length} application{normalizedApps.length !== 1 ? 's' : ''} tracked
          </div>
        </div>
      </div>

      {selectedApp && (
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-black/10 to-transparent p-4 shadow-[0_12px_30px_-24px_rgba(255,255,255,0.45)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Selected Application</div>
              <div className="mt-1 text-white/95 font-semibold text-base truncate">{selectedApp.job_title}</div>
              <div className="text-white/65 text-sm truncate">{selectedApp.company_name}</div>
              {selectedApp.location && (
                <div className="text-white/45 text-xs mt-1">{selectedApp.location}</div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-[11px] text-white/50">Stage</label>
              <select
                value={selectedApp.status}
                onChange={(e) => {
                  const next = e.target.value;
                  const update: Record<string, any> = { status: next };
                  if (next === "applied" && !selectedApp.applied_at) {
                    update.applied_at = new Date().toISOString();
                  }
                  updateApplication(selectedApp.id, update);
                }}
                className="bg-white/[0.08] border border-white/[0.15] text-white/90 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-white/30"
              >
                <option value="saved">Saved</option>
                <option value="applied">Applied</option>
                <option value="response">Response</option>
                <option value="interview">Interview</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] text-white/55 mb-1.5">
              <span>Document readiness</span>
              <span>{completionCount}/3 complete</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-300/80 to-violet-300/80" style={{ width: `${completionPercent}%` }} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              disabled={!selectedApp.job_analysis_id}
              onClick={() => {
                if (selectedApp.has_job_analysis && onOpenApplicationViewer) {
                  onOpenApplicationViewer({
                    type: 'job-analysis',
                    title: selectedApp.job_title,
                    company: selectedApp.company_name,
                    data: selectedApp,
                  });
                } else {
                  onNavigate("job-analysis", { selectedJobId: selectedApp.job_analysis_id || undefined });
                }
              }}
              className={`career-btn-secondary px-3 py-1.5 text-xs rounded-lg ${
                !selectedApp.job_analysis_id ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {selectedApp.has_job_analysis ? "Open Job Analysis" : "Create Job Analysis"}
            </button>
            <button
              onClick={() => {
                if (selectedApp.has_tailored_resume && onOpenApplicationViewer) {
                  onOpenApplicationViewer({
                    type: 'tailored-resume',
                    title: selectedApp.job_title,
                    company: selectedApp.company_name,
                    data: selectedApp,
                  });
                } else {
                  onNavigate("tailor", {
                    selectedJobId: selectedApp.job_analysis_id || undefined,
                  });
                }
              }}
              className="career-btn-secondary px-3 py-1.5 text-xs rounded-lg"
            >
              {selectedApp.has_tailored_resume ? "Open Tailored Resume" : "Create Tailored Resume"}
            </button>
            <button
              onClick={() => {
                if (selectedApp.has_cover_letter && onOpenApplicationViewer) {
                  onOpenApplicationViewer({
                    type: 'cover-letter',
                    title: selectedApp.job_title,
                    company: selectedApp.company_name,
                    data: selectedApp,
                  });
                } else {
                  onNavigate("cover-letter", {
                    selectedJobId: selectedApp.job_analysis_id || undefined,
                  });
                }
              }}
              className="career-btn-secondary px-3 py-1.5 text-xs rounded-lg"
            >
              {selectedApp.has_cover_letter ? "Open Cover Letter" : "Create Cover Letter"}
            </button>
            <button
              onClick={() => deleteApplication(selectedApp.id)}
              disabled={deleting}
              className="text-[11px] px-3 py-1.5 rounded-lg border border-rose-300/35 text-rose-200 hover:bg-rose-400/10 disabled:opacity-50"
            >
              {deleting ? "Removing..." : "Delete"}
            </button>
          </div>

          <div className="mt-4 grid md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50">Applied Method</label>
              <input
                value={selectedApp.applied_method || ""}
                onChange={(e) =>
                  updateApplication(selectedApp.id, { applied_method: e.target.value })
                }
                placeholder="company_website, email, referral, etc."
                className="w-full bg-white/[0.06] border border-white/[0.14] text-white/85 text-xs rounded-lg px-2.5 py-2 outline-none focus:border-white/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50">Applied Notes</label>
              <textarea
                rows={2}
                value={selectedApp.applied_notes || ""}
                onChange={(e) =>
                  updateApplication(selectedApp.id, { applied_notes: e.target.value })
                }
                placeholder="Notes about the submission or follow-up"
                className="w-full bg-white/[0.06] border border-white/[0.14] text-white/85 text-xs rounded-lg px-2.5 py-2 outline-none focus:border-white/30"
              />
            </div>
          </div>

          {saving && (
            <div className="mt-3 text-[11px] text-white/55">Saving…</div>
          )}
        </div>
      )}

      {selectedApp && (
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-sky-400/[0.06] via-white/[0.02] to-violet-400/[0.04] p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Final Check</div>
              <div className="text-sm text-white/85">Scoring engine + Lex decision</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRescore}
                disabled={rescoring}
                className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-[11px] text-white/90 hover:bg-white/15 transition-colors disabled:opacity-50"
              >
                {rescoring ? 'Running final check…' : 'Run final check'}
              </button>
              <button
                type="button"
                onClick={() => setShowScoreSummary((prev) => !prev)}
                className="text-xs text-white/55 hover:text-white flex items-center gap-1"
              >
                {showScoreSummary ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showScoreSummary ? 'Collapse' : 'Expand'}
              </button>
            </div>
          </div>

          {showScoreSummary && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className={`rounded-xl border bg-gradient-to-br px-4 py-3 ${scoreTone}`}>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-white/55">Application Score</div>
                  <div className="mt-2 text-2xl font-semibold leading-none">
                    {typeof numericScore === 'number' ? `${numericScore}/100` : 'Not scored'}
                  </div>
                </div>
                <div className={`rounded-xl border px-4 py-3 ${readinessTone}`}>
                  <div className="text-[11px] uppercase tracking-[0.14em]">Submission Readiness</div>
                  <div className="mt-2 text-xl font-semibold leading-none">{finalReady ? 'Ready to submit' : 'Needs revision'}</div>
                  <div className="mt-1 text-[11px] text-current/75">
                    {finalReady ? 'No blocking issues detected.' : 'Resolve blockers before applying.'}
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-white/12 bg-white/[0.04] p-3">
                  <div className="text-white/55 mb-1">Resume</div>
                  <div className="text-white/90 font-medium">
                    {scoreData?.score?.resumeScore ? `${scoreData.score.resumeScore}/100` : '—'}
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-300/90 to-indigo-300/90"
                      style={{ width: `${Math.max(0, Math.min(100, scoreData?.score?.resumeScore ?? 0))}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-white/12 bg-white/[0.04] p-3">
                  <div className="text-white/55 mb-1">Cover Letter</div>
                  <div className="text-white/90 font-medium">
                    {scoreData?.score?.coverLetterScore ? `${scoreData.score.coverLetterScore}/100` : '—'}
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-fuchsia-300/90 to-rose-300/90"
                      style={{ width: `${Math.max(0, Math.min(100, scoreData?.score?.coverLetterScore ?? 0))}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-white/12 bg-black/20 p-3">
                <button
                  type="button"
                  onClick={() => setShowResumeBreakdown((prev) => !prev)}
                  className="w-full flex items-center justify-between text-xs text-white/70"
                >
                  Resume breakdown
                  {showResumeBreakdown ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {showResumeBreakdown && (
                  <div className="text-xs text-white/65 whitespace-pre-wrap">
                    {scoreData?.score?.resumeScore ? (
                      <div className="space-y-3">
                        {scoreData.resumeAnalysis?.scoreBreakdown ? (
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            {(['formatting', 'keywords', 'content', 'atsCompatibility'] as const).map((key) => {
                              const bucket = scoreData.resumeAnalysis.scoreBreakdown?.[key];
                              if (!bucket) return null;
                              const label =
                                key === 'atsCompatibility' ? 'ATS' : key.charAt(0).toUpperCase() + key.slice(1);
                              return (
                                <div key={key} className="rounded-lg border border-white/12 bg-white/[0.04] p-2.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-white/75">{label}</span>
                                    <span className="text-white/90">
                                      {bucket.score}/{bucket.maxScore}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-white/50">
                                    {bucket.explanation || bucket.rigorousAssessment}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-[11px] text-white/40">
                            Detailed breakdown unavailable for this resume.
                          </div>
                        )}
                        {Array.isArray(scoreData.resumeAnalysis?.ruleIssues) && scoreData.resumeAnalysis.ruleIssues.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[11px] text-white/55">Top issues</div>
                            <div className="space-y-1 text-[11px] text-white/75">
                              {scoreData.resumeAnalysis.ruleIssues.slice(0, 3).map((issue: any, idx: number) => (
                                <div key={`${issue.issue}-${idx}`} className="flex items-start justify-between gap-2">
                                  <span>{issue.issue}</span>
                                  <span className="text-white/40">{issue.severity?.toUpperCase?.() || ''}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      'No resume score available yet. Run final check.'
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-xl border border-white/12 bg-black/20 p-3">
                <button
                  type="button"
                  onClick={() => setShowCoverBreakdown((prev) => !prev)}
                  className="w-full flex items-center justify-between text-xs text-white/70"
                >
                  Cover letter breakdown
                  {showCoverBreakdown ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {showCoverBreakdown && (
                  <div className="text-xs text-white/65 whitespace-pre-wrap">
                    {scoreData?.score?.coverLetterScore ? (
                      <div className="space-y-2 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-white/50">Cover letter score</span>
                          <span className="text-white/85">{scoreData.score.coverLetterScore}/100</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/50">Job alignment</span>
                          <span className="text-white/85">
                            {scoreData.coverLetterBreakdown?.jobAlignment ?? '—'}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/50">Voice match</span>
                          <span className="text-white/85">
                            {scoreData.coverLetterBreakdown?.voiceMatch ?? '—'}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/50">Overall quality</span>
                          <span className="text-white/85">
                            {scoreData.coverLetterBreakdown?.overall ?? '—'}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      'No cover letter score available yet.'
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-xl border border-cyan-300/20 bg-cyan-400/[0.06] p-3">
                <button
                  type="button"
                  onClick={() => setShowLexBreakdown((prev) => !prev)}
                  className="w-full flex items-center justify-between text-base text-cyan-100/85"
                >
                  Lex final review
                  {showLexBreakdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <div className="text-base text-white/75 space-y-2">
                  {parsedLexReview ? (
                    <div className="grid sm:grid-cols-2 gap-2 text-[15px]">
                      <div className="rounded-lg border border-white/12 bg-white/[0.04] p-2">
                        <div className="text-white/45">Lex score</div>
                        <div className="text-white/90 font-medium">{parsedLexReview.score || '—'}</div>
                      </div>
                      <div className="rounded-lg border border-white/12 bg-white/[0.04] p-2">
                        <div className="text-white/45">Lex readiness</div>
                        <div className="text-white/90 font-medium">{parsedLexReview.ready || '—'}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[15px] text-white/55">Lex review will populate after final check runs.</div>
                  )}
                </div>

                {showLexBreakdown && parsedLexReview && (
                  <div className="text-base text-white/80 space-y-3">
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowLexBlockers((prev) => !prev)}
                        className="w-full flex items-center justify-between text-[15px] text-white/65"
                      >
                        Blockers
                        <div className="flex items-center gap-1 text-white/45">
                          <span>{parsedLexReview.blockers.length}</span>
                          {showLexBlockers ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </button>
                      {showLexBlockers && parsedLexReview.blockers.length > 0 && (
                        <ul className="space-y-1 text-[15px] text-rose-100/85">
                          {parsedLexReview.blockers.map((item, idx) => (
                            <li key={`blocker-${idx}`} className="leading-snug">- {item}</li>
                          ))}
                        </ul>
                      )}
                      {showLexBlockers && parsedLexReview.blockers.length === 0 && (
                        <div className="text-[15px] text-white/45">No blockers listed.</div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowLexStrengths((prev) => !prev)}
                        className="w-full flex items-center justify-between text-[15px] text-white/65"
                      >
                        Strengths
                        {showLexStrengths ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      {showLexStrengths && parsedLexReview.strengths.length > 0 ? (
                        <ul className="space-y-1 text-[15px] text-emerald-100/85">
                          {parsedLexReview.strengths.map((item, idx) => (
                            <li key={`strength-${idx}`} className="leading-snug">- {item}</li>
                          ))}
                        </ul>
                      ) : showLexStrengths ? (
                        <div className="text-[15px] text-white/45">No strengths listed.</div>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowLexWeakSpots((prev) => !prev)}
                        className="w-full flex items-center justify-between text-[15px] text-white/65"
                      >
                        Weak spots
                        {showLexWeakSpots ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      {showLexWeakSpots && parsedLexReview.weakSpots.length > 0 ? (
                        <ul className="space-y-1 text-[15px] text-amber-100/85">
                          {parsedLexReview.weakSpots.map((item, idx) => (
                            <li key={`weak-${idx}`} className="leading-snug">- {item}</li>
                          ))}
                        </ul>
                      ) : showLexWeakSpots ? (
                        <div className="text-[15px] text-white/45">No weak spots listed.</div>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowLexFixes((prev) => !prev)}
                        className="w-full flex items-center justify-between text-[15px] text-white/65"
                      >
                        Fix before submitting
                        {showLexFixes ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      {showLexFixes && parsedLexReview.fixes.length > 0 ? (
                        <ul className="space-y-1 text-[15px] text-cyan-100/90">
                          {parsedLexReview.fixes.map((item, idx) => (
                            <li key={`fix-${idx}`} className="leading-snug">- {item}</li>
                          ))}
                        </ul>
                      ) : showLexFixes ? (
                        <div className="text-[15px] text-white/45">No fixes listed.</div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {normalizedApps.map((app) => {
          const appCompletion = [app.has_job_analysis, app.has_tailored_resume, app.has_cover_letter].filter(Boolean).length;
          return (
            <div
              key={app.id}
              onClick={() => setSelectedId(app.id)}
              className={`group p-4 rounded-xl border transition-all cursor-pointer ${
                selectedId === app.id
                  ? "border-cyan-300/40 bg-gradient-to-r from-cyan-400/[0.12] to-violet-400/[0.10] shadow-[0_14px_30px_-22px_rgba(59,130,246,0.75)]"
                  : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/20"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white/92 font-medium truncate">{app.job_title}</p>
                  <p className="text-white/55 text-sm truncate">{app.company_name}</p>
                  {app.location && (
                    <p className="text-white/35 text-xs mt-1 truncate">{app.location}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] border ${
                    app.status === 'interview'
                      ? 'bg-emerald-400/15 text-emerald-200 border-emerald-300/30'
                      : app.status === 'applied'
                      ? 'bg-sky-400/15 text-sky-200 border-sky-300/30'
                      : 'bg-white/[0.06] text-white/60 border-white/[0.14]'
                  }`}>
                    {app.status}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteApplication(app.id);
                    }}
                    className="p-1 rounded-md border border-rose-300/35 text-rose-200 hover:bg-rose-400/10"
                    aria-label="Delete application"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] text-white/45">
                  <span>Readiness</span>
                  <span className="text-white/60">{appCompletion}/3</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-300/90 to-cyan-300/90"
                    style={{ width: `${Math.round((appCompletion / 3) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3 text-[10px]">
                <span className={app.has_job_analysis ? "text-emerald-300/85" : "text-white/35"}>Job Analysis</span>
                <span className={app.has_tailored_resume ? "text-emerald-300/85" : "text-white/35"}>Tailored Resume</span>
                <span className={app.has_cover_letter ? "text-emerald-300/85" : "text-white/35"}>Cover Letter</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Need React import for ApplicationsInlineView
import React from 'react';

// ============================================================================
// DASHBOARD WORKSPACE
// ============================================================================
export function DashboardWorkspace({
  workspaceContext,
  onNavigate
}: WorkspaceWrapperProps) {
  return (
    <div className="p-8 space-y-8">
      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
        <WorkspaceCard
          title="Analyze Job"
          description="Decode job postings for insights"
          icon=""
          onClick={() => onNavigate('job-analysis')}
        />

        <WorkspaceCard
          title="Tailor Resume"
          description="Align your resume to jobs"
          icon=""
          onClick={() => onNavigate('tailor')}
        />

        <WorkspaceCard
          title="Cover Letter"
          description="Generate authentic letters"
          icon="️"
          onClick={() => onNavigate('cover-letter')}
        />

        <WorkspaceCard
          title="Career Assessment"
          description="20-min assessment"
          icon=""
          onClick={() => onNavigate('assessment')}
        />

        <WorkspaceCard
          title="Applications"
          description="Track your pipeline"
          icon=""
          onClick={() => onNavigate('applications')}
        />

        <WorkspaceCard
          title="Resume Manager"
          description="Upload & manage resumes"
          icon=""
          onClick={() => onNavigate('resume-manager')}
        />

        <WorkspaceCard
          title="Resume Builder"
          description="Build your resume with Lex"
          icon=""
          onClick={() => onNavigate('resume-builder')}
        />
      </div>

      {/* Tip */}
      <div className="text-center text-white/30 text-sm">
         Tip: Ask Lex anything in the sidebar to get personalized guidance
      </div>
    </div>
  );
}

// Workspace Card Component
function WorkspaceCard({
  title,
  description,
  icon,
  onClick
}: {
  title: string;
  description: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="career-card p-6 hover:border-[#9333EA]/40 rounded-xl text-left transition-all group"
    >
      <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="font-medium text-white/90 mb-1">{title}</div>
      <div className="text-sm text-white/50">{description}</div>
    </button>
  );
}
