// Career Studio Workspace Types
// src/types/career-studio-workspace.ts

export type WorkspaceView =
  | 'dashboard'
  | 'job-analysis'
  | 'tailor'
  | 'cover-letter'
  | 'assessment'
  | 'applications'
  | 'resume-manager'
  | 'resume-builder';

export interface WorkspaceState {
  currentView: WorkspaceView;
  context: WorkspaceContext;
  history: WorkspaceView[];
}

export interface WorkspaceContext {
  selectedResumeId?: string;
  selectedJobId?: string;
  selectedApplicationId?: string;
  assessmentPhase?: number;
}

export interface WorkspaceConfig {
  view: WorkspaceView;
  title: string;
  description: string;
  icon?: string;
}
