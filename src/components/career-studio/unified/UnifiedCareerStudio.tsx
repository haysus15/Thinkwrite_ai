// Unified Career Studio - Main 3-Panel Container
// src/components/career-studio/unified/UnifiedCareerStudio.tsx

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import LexSidebarUnified from './LexSidebarUnified';
import WorkspaceContainer from './WorkspaceContainer';
import ContextPanelUnified from './ContextPanelUnified';
import { WorkspaceState, WorkspaceView, WorkspaceContext } from '@/types/career-studio-workspace';
import CareerStudioTour from '../CareerStudioTour';
import ResumeManagerResultsPanel from '../resume-manager/ResumeManagerResultsPanel';
import { ResumeManagerPanelProvider, useResumeManagerPanel } from '../resume-manager/ResumeManagerPanelContext';

function UnifiedCareerStudioContent() {
  const searchParams = useSearchParams();
  const initialWorkspace = (searchParams.get('workspace') as WorkspaceView) || 'dashboard';
  const initialResumeId = searchParams.get('resumeId') || undefined;
  const initialJobId = searchParams.get('jobId') || undefined;
  const [isFirstTime, setIsFirstTime] = useState(false);
  const panelsRef = useRef<HTMLDivElement | null>(null);
  const rightTouchedRef = useRef(false);
  const leftTouchedRef = useRef(false);
  const { panel } = useResumeManagerPanel();

  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>({
    currentView: initialWorkspace,
    context: {
      selectedResumeId: initialResumeId,
      selectedJobId: initialJobId,
    },
    history: [initialWorkspace]
  });

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(520);
  const [resizing, setResizing] = useState<'left' | 'right' | null>(null);

  // Update workspace when URL changes
  useEffect(() => {
    const workspace = searchParams.get('workspace') as WorkspaceView;
    if (workspace && workspace !== workspaceState.currentView) {
      switchWorkspace(workspace);
    }
  }, [searchParams]);

  useEffect(() => {
    setIsFirstTime(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedLeftCollapsed = window.localStorage.getItem('careerStudioLeftCollapsed');
    const storedRightCollapsed = window.localStorage.getItem('careerStudioRightCollapsed');
    const storedLeftWidth = window.localStorage.getItem('careerStudioLeftWidth');
    const storedRightWidth = window.localStorage.getItem('careerStudioRightWidth');

    if (storedLeftCollapsed !== null) {
      setLeftCollapsed(storedLeftCollapsed === 'true');
      leftTouchedRef.current = true;
    }
    if (storedRightCollapsed !== null) {
      setRightCollapsed(storedRightCollapsed === 'true');
      rightTouchedRef.current = true;
    }
    if (storedLeftWidth) {
      const next = Number(storedLeftWidth);
      if (!Number.isNaN(next)) setLeftWidth(next);
    }
    if (storedRightWidth) {
      const next = Number(storedRightWidth);
      if (!Number.isNaN(next)) setRightWidth(Math.max(420, next));
    }
  }, [initialWorkspace]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('careerStudioLeftCollapsed', String(leftCollapsed));
    window.localStorage.setItem('careerStudioRightCollapsed', String(rightCollapsed));
  }, [leftCollapsed, rightCollapsed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('careerStudioLeftWidth', String(leftWidth));
    window.localStorage.setItem('careerStudioRightWidth', String(rightWidth));
  }, [leftWidth, rightWidth]);

  useEffect(() => {
    if (workspaceState.currentView !== 'resume-manager') return;
    if (!panel?.active) return;
    if (rightTouchedRef.current) return;
    setRightCollapsed(false);
  }, [workspaceState.currentView, panel?.active]);

  useEffect(() => {
    if (workspaceState.currentView !== 'resume-manager') return;
    if (panel?.active) return;
    setRightCollapsed(true);
  }, [workspaceState.currentView, panel?.active]);

  useEffect(() => {
    if (workspaceState.currentView !== 'resume-manager') return;
    if (!panel?.active) return;
    if (!panel?.openDraftEditorSignal) return;
    setRightCollapsed(false);
  }, [workspaceState.currentView, panel?.active, panel?.openDraftEditorSignal]);

  useEffect(() => {
    if (!resizing) return;
    const handleMouseMove = (event: MouseEvent) => {
      if (!panelsRef.current) return;
      const rect = panelsRef.current.getBoundingClientRect();
      if (resizing === 'left') {
        const raw = event.clientX - rect.left;
        const clamped = Math.min(420, Math.max(220, raw));
        setLeftWidth(clamped);
      } else {
        const raw = rect.right - event.clientX;
        const clamped = Math.min(720, Math.max(320, raw));
        setRightWidth(clamped);
      }
    };
    const handleMouseUp = () => setResizing(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

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

        <div className="career-panels-row" ref={panelsRef}>
          {/* Left: Lex Sidebar (Always Visible) */}
          <div
            className="career-panel flex-shrink-0"
            style={{ width: leftCollapsed ? 36 : leftWidth }}
          >
            <div className="career-panel-toggle">
              <button
                type="button"
                className="career-panel-toggle-button"
                onClick={() => {
                  leftTouchedRef.current = true;
                  setLeftCollapsed((prev) => !prev);
                }}
                aria-label={leftCollapsed ? 'Expand Lex panel' : 'Collapse Lex panel'}
              >
                {leftCollapsed ? '›' : '‹'}
              </button>
            </div>
            {!leftCollapsed && (
              <LexSidebarUnified
                workspaceState={workspaceState}
                onWorkspaceSwitch={switchWorkspace}
                onContextUpdate={updateContext}
              />
            )}
          </div>

          <div
            className="career-resize-handle"
            onMouseDown={() => {
              if (leftCollapsed) return;
              leftTouchedRef.current = true;
              setResizing('left');
            }}
          />

          {/* Center: Dynamic Workspace */}
          <div className="career-panel flex-1">
            <WorkspaceContainer
              workspaceState={workspaceState}
              onWorkspaceSwitch={switchWorkspace}
              onContextUpdate={updateContext}
            />
          </div>

          {workspaceState.currentView === 'resume-manager' ? (
            <>
              <div
                className="career-resize-handle"
                onMouseDown={() => {
                  if (rightCollapsed || !panel?.active) return;
                  rightTouchedRef.current = true;
                  setResizing('right');
                }}
              />

              <div
                className="career-panel career-panel-right flex-shrink-0"
                style={{ width: rightCollapsed ? 36 : rightWidth }}
              >
                {!rightCollapsed && panel?.active && panel && (
                  <ResumeManagerResultsPanel data={panel} />
                )}
              </div>
            </>
          ) : (
            <>
              <div
                className="career-resize-handle"
                onMouseDown={() => {
                  if (rightCollapsed) return;
                  rightTouchedRef.current = true;
                  setResizing('right');
                }}
              />

              {/* Right: Context Panel */}
              <div
                className="career-panel flex-shrink-0"
                style={{ width: rightCollapsed ? 36 : rightWidth }}
              >
                <div className="career-panel-toggle career-panel-toggle-right">
                  <button
                    type="button"
                    className="career-panel-toggle-button"
                    onClick={() => {
                      rightTouchedRef.current = true;
                      setRightCollapsed((prev) => !prev);
                    }}
                    aria-label={rightCollapsed ? 'Expand documents panel' : 'Collapse documents panel'}
                  >
                    {rightCollapsed ? '‹' : '›'}
                  </button>
                </div>
                {!rightCollapsed && (
                  <ContextPanelUnified
                    workspaceState={workspaceState}
                    onWorkspaceSwitch={switchWorkspace}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <CareerStudioTour
        isFirstTime={isFirstTime && workspaceState.currentView === 'dashboard'}
        onComplete={() => {}}
        onStartResumeManager={() => switchWorkspace('resume-manager')}
      />
    </div>
  );
}

export default function UnifiedCareerStudio() {
  return (
    <ResumeManagerPanelProvider>
      <UnifiedCareerStudioContent />
    </ResumeManagerPanelProvider>
  );
}
