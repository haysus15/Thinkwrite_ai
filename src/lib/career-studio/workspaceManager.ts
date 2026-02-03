// Workspace Manager - Career Studio
// src/lib/career-studio/workspaceManager.ts

import { WorkspaceView, WorkspaceConfig } from '@/types/career-studio-workspace';

const WORKSPACE_CONFIGS: Record<WorkspaceView, WorkspaceConfig> = {
  'dashboard': {
    view: 'dashboard',
    title: 'Career Dashboard',
    description: 'Overview and quick actions',
    icon: 'home'
  },
  'job-analysis': {
    view: 'job-analysis',
    title: 'Job Analysis',
    description: 'Decode job postings for requirements & insights',
    icon: 'briefcase'
  },
  'tailor': {
    view: 'tailor',
    title: 'Resume Tailoring',
    description: 'Strategically align your resume to job postings',
    icon: 'target'
  },
  'cover-letter': {
    view: 'cover-letter',
    title: 'Cover Letter',
    description: 'Generate authentic cover letters',
    icon: 'mail'
  },
  'assessment': {
    view: 'assessment',
    title: 'Career Assessment',
    description: '20-minute career discovery with Lex',
    icon: 'compass'
  },
  'applications': {
    view: 'applications',
    title: 'Applications',
    description: 'Track your job application pipeline',
    icon: 'clipboard'
  },
  'resume-manager': {
    view: 'resume-manager',
    title: 'Resume Manager',
    description: 'Upload and manage your resumes',
    icon: 'file-text'
  },
  'resume-builder': {
    view: 'resume-builder',
    title: 'Resume Builder',
    description: 'Build your resume with Lex guidance',
    icon: 'edit'
  }
};

export function getWorkspaceConfig(view: WorkspaceView): WorkspaceConfig {
  return WORKSPACE_CONFIGS[view];
}

export function getAllWorkspaceConfigs(): WorkspaceConfig[] {
  return Object.values(WORKSPACE_CONFIGS);
}

// Detect workspace from Lex conversation intent
export function detectWorkspaceIntent(userMessage: string): WorkspaceView | null {
  const lower = userMessage.toLowerCase();

  // Job Analysis intents
  if (lower.includes('analyze') && (lower.includes('job') || lower.includes('posting'))) {
    return 'job-analysis';
  }
  if (lower.includes('decode') && lower.includes('job')) {
    return 'job-analysis';
  }

  // Resume Tailoring intents
  if (lower.includes('tailor') || lower.includes('align resume')) {
    return 'tailor';
  }
  if (lower.includes('customize') && lower.includes('resume')) {
    return 'tailor';
  }

  // Cover Letter intents
  if (lower.includes('cover letter')) {
    return 'cover-letter';
  }
  if (lower.includes('write') && lower.includes('letter')) {
    return 'cover-letter';
  }

  // Assessment intents
  if (lower.includes('assessment') || lower.includes('career plan')) {
    return 'assessment';
  }
  if (lower.includes('roadmap') || lower.includes('career path')) {
    return 'assessment';
  }

  // Applications intents
  if (lower.includes('application') && (lower.includes('track') || lower.includes('status') || lower.includes('pipeline'))) {
    return 'applications';
  }
  if (lower.includes('applied') && lower.includes('jobs')) {
    return 'applications';
  }

  // Resume Manager intents
  if (lower.includes('upload') && lower.includes('resume')) {
    return 'resume-manager';
  }
  if (lower.includes('my resumes') || lower.includes('manage resume')) {
    return 'resume-manager';
  }

  // Resume Builder intents
  if (lower.includes('build') && lower.includes('resume')) {
    return 'resume-builder';
  }
  if (lower.includes('create') && lower.includes('resume')) {
    return 'resume-builder';
  }

  // Dashboard intents
  if (lower.includes('dashboard') || lower.includes('overview') || lower.includes('home')) {
    return 'dashboard';
  }

  return null; // Stay on current workspace
}

// Map old routes to workspace views
export function routeToWorkspace(route: string): WorkspaceView {
  const routeMap: Record<string, WorkspaceView> = {
    '/career-studio/dashboard': 'dashboard',
    '/career-studio/job-analysis': 'job-analysis',
    '/career-studio/tailor-resume': 'tailor',
    '/career-studio/cover-letter': 'cover-letter',
    '/career-studio/assessment': 'assessment',
    '/career-studio/applications': 'applications',
    '/career-studio/resume-manager': 'resume-manager',
    '/career-studio/resume-builder': 'resume-builder',
  };

  return routeMap[route] || 'dashboard';
}
