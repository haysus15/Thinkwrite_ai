// Workspace Container - Dynamic workspace switcher
// src/components/career-studio/unified/WorkspaceContainer.tsx

'use client';

import { WorkspaceState, WorkspaceView, WorkspaceContext } from '@/types/career-studio-workspace';
import {
  DashboardWorkspace,
  JobAnalysisWorkspace,
  TailoringWorkspace,
  CoverLetterWorkspace,
  AssessmentWorkspace,
  ApplicationsWorkspace,
  ResumeManagerWorkspace,
  ResumeBuilderWorkspace
} from './WorkspaceWrappers';

interface WorkspaceContainerProps {
  workspaceState: WorkspaceState;
  onWorkspaceSwitch: (view: WorkspaceView, context?: Partial<WorkspaceContext>) => void;
  onContextUpdate: (context: Partial<WorkspaceContext>) => void;
}

export default function WorkspaceContainer({
  workspaceState,
  onWorkspaceSwitch,
  onContextUpdate
}: WorkspaceContainerProps) {
  // Common props for all workspace wrappers
  const commonProps = {
    workspaceContext: workspaceState.context,
    onNavigate: onWorkspaceSwitch,
    onContextUpdate,
    workspaceView: workspaceState.currentView
  };

  // Render the appropriate workspace component
  const renderWorkspace = () => {
    switch (workspaceState.currentView) {
      case 'dashboard':
        return <DashboardWorkspace {...commonProps} />;
      case 'job-analysis':
        return <JobAnalysisWorkspace {...commonProps} />;
      case 'tailor':
        return <TailoringWorkspace {...commonProps} />;
      case 'cover-letter':
        return <CoverLetterWorkspace {...commonProps} />;
      case 'assessment':
        return <AssessmentWorkspace {...commonProps} />;
      case 'applications':
        return <ApplicationsWorkspace {...commonProps} />;
      case 'resume-manager':
        return <ResumeManagerWorkspace {...commonProps} />;
      case 'resume-builder':
        return <ResumeBuilderWorkspace {...commonProps} />;
      default:
        return <DashboardWorkspace {...commonProps} />;
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-white/[0.01]">
      {/* Workspace Content - YOUR COMPONENTS LOAD HERE */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {renderWorkspace()}
      </div>
    </div>
  );
}
