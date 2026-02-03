// Workspace Wrappers - Thin wrappers for existing components
// src/components/career-studio/unified/WorkspaceWrappers.tsx
// CRITICAL: These are THIN wrappers - just pass props to existing components!

'use client';

import { WorkspaceContext, WorkspaceView } from '@/types/career-studio-workspace';
import { getWorkspaceConfig } from '@/lib/career-studio/workspaceManager';
import { ChevronLeft } from 'lucide-react';

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
export function TailoringWorkspace({ workspaceContext, workspaceView, onNavigate }: WorkspaceWrapperProps) {
  return (
    <div className="h-full overflow-auto">
      <WorkspaceHeader workspaceView={workspaceView} onNavigate={onNavigate} />
      <TailorResumeInterface
        jobAnalysisId={workspaceContext.selectedJobId}
        masterResumeId={workspaceContext.selectedResumeId}
      />
    </div>
  );
}

// ============================================================================
// COVER LETTER WORKSPACE
// ============================================================================
export function CoverLetterWorkspace({ workspaceContext, workspaceView, onNavigate }: WorkspaceWrapperProps) {
  return (
    <div className="h-full overflow-auto">
      <WorkspaceHeader workspaceView={workspaceView} onNavigate={onNavigate} />
      <CoverLetterGenerator
        resumeId={workspaceContext.selectedResumeId}
        jobAnalysisId={workspaceContext.selectedJobId}
      />
    </div>
  );
}

// ============================================================================
// ASSESSMENT WORKSPACE
// ============================================================================
export function AssessmentWorkspace({ workspaceContext, workspaceView, onNavigate }: WorkspaceWrapperProps) {
  return (
    <div className="h-full overflow-auto">
      <WorkspaceHeader workspaceView={workspaceView} onNavigate={onNavigate} />
      <CareerAssessmentInterface
        // These props can be passed from API later if needed
        hasCompletedBefore={false}
        lastCompletedDate={undefined}
        variant="progress"
        currentPhase={workspaceContext.assessmentPhase}
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
export function ApplicationsWorkspace({ workspaceContext, workspaceView, onNavigate }: WorkspaceWrapperProps) {
  // Applications page has its own full implementation
  // We'll create a simplified inline version or redirect
  return (
    <div className="h-full overflow-auto">
      <WorkspaceHeader workspaceView={workspaceView} onNavigate={onNavigate} />
      <ApplicationsInlineView />
    </div>
  );
}

// Inline Applications View (simplified version for workspace)
function ApplicationsInlineView() {
  const [apps, setApps] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

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

  return (
    <div className="p-6 space-y-4">
      <div className="text-sm text-white/60 mb-4">
        {apps.length} application{apps.length !== 1 ? 's' : ''} tracked
      </div>

      <div className="space-y-3">
        {apps.map((app) => (
          <div
            key={app.id}
            className="p-4 bg-white/[0.03] border border-white/[0.08] rounded-lg hover:bg-white/[0.05] transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/90 font-medium">{app.job_title}</p>
                <p className="text-white/50 text-sm">{app.company_name}</p>
                {app.location && (
                  <p className="text-white/30 text-xs mt-1">{app.location}</p>
                )}
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] ${
                app.status === 'interview'
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : app.status === 'applied'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-white/[0.05] text-white/50 border border-white/[0.08]'
              }`}>
                {app.status}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3 text-[10px] text-white/40">
              {app.has_job_analysis && <span className="text-emerald-400/70">Job Analysis</span>}
              {app.has_tailored_resume && <span className="text-emerald-400/70">Tailored Resume</span>}
              {app.has_cover_letter && <span className="text-emerald-400/70">Cover Letter</span>}
            </div>
          </div>
        ))}
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
