// Unified Career Studio - Main 3-Panel Container
// src/components/career-studio/unified/UnifiedCareerStudio.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import LexSidebarUnified from './LexSidebarUnified';
import WorkspaceContainer from './WorkspaceContainer';
import ContextPanelUnified from './ContextPanelUnified';
import { WorkspaceState, WorkspaceView, WorkspaceContext } from '@/types/career-studio-workspace';

export default function UnifiedCareerStudio() {
  const searchParams = useSearchParams();
  const initialWorkspace = (searchParams.get('workspace') as WorkspaceView) || 'dashboard';
  const initialResumeId = searchParams.get('resumeId') || undefined;
  const initialJobId = searchParams.get('jobId') || undefined;

  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>({
    currentView: initialWorkspace,
    context: {
      selectedResumeId: initialResumeId,
      selectedJobId: initialJobId,
    },
    history: [initialWorkspace]
  });

  // Update workspace when URL changes
  useEffect(() => {
    const workspace = searchParams.get('workspace') as WorkspaceView;
    if (workspace && workspace !== workspaceState.currentView) {
      switchWorkspace(workspace);
    }
  }, [searchParams]);

  // Sync resumeId/jobId query params into shared workspace context
  useEffect(() => {
    const resumeId = searchParams.get('resumeId') || undefined;
    const jobId = searchParams.get('jobId') || undefined;

    setWorkspaceState((prev) => {
      if (
        prev.context.selectedResumeId === resumeId &&
        prev.context.selectedJobId === jobId
      ) {
        return prev;
      }

      return {
        ...prev,
        context: {
          ...prev.context,
          selectedResumeId: resumeId,
          selectedJobId: jobId,
        },
      };
    });
  }, [searchParams]);

  const switchWorkspace = (view: WorkspaceView, contextUpdates?: Partial<WorkspaceContext>) => {
    setWorkspaceState(prev => ({
      currentView: view,
      context: { ...prev.context, ...contextUpdates },
      history: [...prev.history.slice(-9), view] // Keep last 10 entries
    }));

    // Update URL without page reload
    const url = new URL(window.location.href);
    url.searchParams.set('workspace', view);
    window.history.pushState({}, '', url.toString());
  };

  const updateContext = useCallback((updates: Partial<WorkspaceContext>) => {
    setWorkspaceState(prev => ({
      ...prev,
      context: { ...prev.context, ...updates }
    }));
  }, []);

  return (
    <div className="career-studio-root font-['Orbitron']">
      <div className="career-sky-layer">
        <div className="career-stars-layer" />
        <div className="career-nebula-layer" />
        <div className="career-milky-way" />
        <div className="career-planets" />
        <div className="career-meteors" />
        <div className="career-shooting-star" />
      </div>

      <div className="career-content-layer">
        <header className="career-global-header">
          <Link href="/select-studio" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="career-header-mark">TW</div>
            <div className="career-header-title">ThinkWrite AI · Career Studio</div>
          </Link>
        </header>

        <div className="career-panels-row">
          {/* Left: Lex Sidebar (Always Visible) */}
          <div className="career-panel w-80 flex-shrink-0">
            <LexSidebarUnified
              workspaceState={workspaceState}
              onWorkspaceSwitch={switchWorkspace}
              onContextUpdate={updateContext}
            />
          </div>

          {/* Center: Dynamic Workspace */}
          <div className="career-panel flex-1">
            <WorkspaceContainer
              workspaceState={workspaceState}
              onWorkspaceSwitch={switchWorkspace}
              onContextUpdate={updateContext}
            />
          </div>

          {/* Right: Context Panel */}
          <div className="career-panel w-72 flex-shrink-0">
            <ContextPanelUnified
              workspaceState={workspaceState}
              onWorkspaceSwitch={switchWorkspace}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
