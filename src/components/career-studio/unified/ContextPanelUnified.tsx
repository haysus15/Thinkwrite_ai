// Context Panel - Unified Career Studio
// src/components/career-studio/unified/ContextPanelUnified.tsx

'use client';

import { useState, useEffect } from 'react';
import { FileText, Briefcase, Target, Plus, RefreshCw, ClipboardList, MoreVertical } from 'lucide-react';
import { WorkspaceState, WorkspaceView, WorkspaceContext } from '@/types/career-studio-workspace';

interface ContextPanelUnifiedProps {
  workspaceState: WorkspaceState;
  onWorkspaceSwitch: (view: WorkspaceView, context?: Partial<WorkspaceContext>) => void;
}

interface DocumentItem {
  id: string;
  title: string;
  subtitle?: string;
  type: 'resume' | 'job' | 'cover-letter' | 'assessment';
  date: string;
  isMaster?: boolean;
  score?: number;
}

interface ResumeDetail {
  id: string;
  fileName: string;
  rawText: string;
  overallScore?: number;
  topIssues: string[];
}

export default function ContextPanelUnified({
  workspaceState,
  onWorkspaceSwitch
}: ContextPanelUnifiedProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'resumes' | 'jobs' | 'assessments'>('all');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [resumeDetail, setResumeDetail] = useState<ResumeDetail | null>(null);
  const [resumeDetailLoading, setResumeDetailLoading] = useState(false);
  const [importingResumeId, setImportingResumeId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [workspaceState.currentView]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      // Load resumes and job analyses in parallel
      const [resumesRes, jobsRes, assessmentsRes] = await Promise.all([
        fetch("/api/resumes").catch(() => null),
        fetch("/api/job-analysis?saved=true").catch(() => null),
        fetch("/api/career-assessment/list").catch(() => null)
      ]);

      const resumes = resumesRes ? await resumesRes.json() : { resumes: [] };
      const jobs = jobsRes ? await jobsRes.json() : { analyses: [] };
      const assessments = assessmentsRes ? await assessmentsRes.json() : { assessments: [] };

      const allDocs: DocumentItem[] = [
        ...(resumes.resumes || []).map((r: any) => ({
          id: r.id,
          title: r.fileName || r.file_name || r.title || 'Untitled Resume',
          type: 'resume' as const,
          date: r.created_at || r.uploadedAt || new Date().toISOString(),
          isMaster: r.isMasterResume || r.is_master,
          score: r.analysisResults?.overallScore
        })),
        ...(jobs.analyses || []).map((j: any) => ({
          id: j.id,
          title: j.job_title || 'Untitled Job',
          subtitle: j.company_name,
          type: 'job' as const,
          date: j.created_at
        })),
        ...(assessments.assessments || []).map((assessment: any) => ({
          id: assessment.id,
          title: 'Career Assessment',
          subtitle: assessment.completed_at ? 'Completed' : 'In progress',
          type: 'assessment' as const,
          date: assessment.completed_at || assessment.created_at || new Date().toISOString()
        }))
      ];

      // Sort by date (newest first)
      allDocs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setDocuments(allDocs);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocs = documents.filter(doc => {
    if (activeTab === 'all') return true;
    if (activeTab === 'resumes') return doc.type === 'resume';
    if (activeTab === 'jobs') return doc.type === 'job';
    if (activeTab === 'assessments') return doc.type === 'assessment';
    return true;
  });

  const handleDocumentClick = (doc: DocumentItem) => {
    if (doc.type === 'resume') {
      void loadResumeDetail(doc.id);
      return;
    }
    if (doc.type === 'job') {
      onWorkspaceSwitch('job-analysis', { selectedJobId: doc.id });
      return;
    }
    if (doc.type === 'assessment') {
      window.location.href = `/career-studio/assessment/results?id=${doc.id}`;
    }
  };

  const loadResumeDetail = async (resumeId: string) => {
    setSelectedResumeId(resumeId);
    setResumeDetailLoading(true);
    setImportError(null);
    try {
      const response = await fetch(`/api/resumes/${resumeId}`);
      const data = await response.json();
      if (!data?.success || !data?.resume) {
        setResumeDetail(null);
        return;
      }

      const automatedAnalysis = data.resume.automatedAnalysis || {};
      const resumeQuotes = Array.isArray(automatedAnalysis.resumeQuotes)
        ? automatedAnalysis.resumeQuotes
        : [];
      const topIssues = resumeQuotes
        .map((q: any) => q?.issue)
        .filter((issue: any) => typeof issue === 'string' && issue.trim().length > 0)
        .slice(0, 3);

      const rawText =
        data.resume.extractedText ||
        data.resume.fullText ||
        automatedAnalysis.extractedText ||
        '';

      setResumeDetail({
        id: resumeId,
        fileName: data.resume.fileName || 'Resume',
        rawText: String(rawText || ''),
        overallScore: automatedAnalysis.overallScore,
        topIssues,
      });
    } catch (error) {
      console.error('Failed to load resume detail:', error);
      setResumeDetail(null);
    } finally {
      setResumeDetailLoading(false);
    }
  };

  const handleImportToBuilder = async () => {
    if (!resumeDetail?.id) return;
    setImportingResumeId(resumeDetail.id);
    setImportError(null);
    try {
      const response = await fetch('/api/resume-builder/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: resumeDetail.id })
      });
      const data = await response.json();
      if (!data?.success || !data?.resume?.id) {
        throw new Error(data?.error || 'Import failed');
      }
      onWorkspaceSwitch('resume-builder', { selectedResumeId: data.resume.id });
    } catch (error: any) {
      console.error('Failed to import resume:', error);
      setImportError(error?.message || 'Failed to import resume');
    } finally {
      setImportingResumeId(null);
    }
  };

  const handleSetMaster = async (doc: DocumentItem) => {
    try {
      await fetch(`/api/resumes/${doc.id}/master`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      await loadDocuments();
      if (doc.type === 'resume' && selectedResumeId === doc.id) {
        void loadResumeDetail(doc.id);
      }
    } catch (error) {
      console.error('Failed to set master resume:', error);
    }
  };

  const handleDelete = async (doc: DocumentItem) => {
    if (!confirm('Delete this item?')) return;
    try {
      if (doc.type === 'resume') {
        await fetch(`/api/resumes/${doc.id}/delete`, { method: 'DELETE' });
      } else if (doc.type === 'job') {
        await fetch(`/api/job-analysis/${doc.id}`, { method: 'DELETE' });
      } else if (doc.type === 'assessment') {
        await fetch(`/api/career-assessment/${doc.id}`, { method: 'DELETE' });
      }
      await loadDocuments();
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.08]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white/90">Documents</h3>
          <button
            onClick={loadDocuments}
            disabled={loading}
            className="p-1.5 hover:bg-white/[0.05] rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-white/40 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tab filters */}
        <div className="flex gap-1">
          <TabButton active={activeTab === 'all'} onClick={() => setActiveTab('all')}>
            All
          </TabButton>
          <TabButton active={activeTab === 'resumes'} onClick={() => setActiveTab('resumes')}>
            Resumes
          </TabButton>
          <TabButton active={activeTab === 'jobs'} onClick={() => setActiveTab('jobs')}>
            Jobs
          </TabButton>
          <TabButton active={activeTab === 'assessments'} onClick={() => setActiveTab('assessments')}>
            Assessments
          </TabButton>
        </div>
      </div>

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="text-center py-8 text-white/30 text-sm">
            Loading...
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-white/40 text-sm mb-2">No documents yet</p>
            <p className="text-white/30 text-xs">
              Upload a resume or analyze a job to get started
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredDocs.slice(0, 15).map((doc) => (
              <div
                key={doc.id}
                className={`w-full p-3 border rounded-lg text-left transition-all group relative ${
                  doc.type === 'resume' && selectedResumeId === doc.id
                    ? 'bg-white/[0.07] border-white/[0.16]'
                    : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                <button
                  onClick={() => handleDocumentClick(doc)}
                  className="w-full text-left"
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`mt-0.5 p-1.5 rounded ${
                      doc.type === 'resume'
                        ? 'bg-blue-500/10 text-blue-400'
                        : doc.type === 'assessment'
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : 'bg-purple-500/10 text-purple-400'
                    }`}>
                      {doc.type === 'resume' ? (
                        <FileText className="w-3.5 h-3.5" />
                      ) : doc.type === 'assessment' ? (
                        <ClipboardList className="w-3.5 h-3.5" />
                      ) : (
                        <Briefcase className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm text-white/80 font-medium truncate">
                          {doc.title}
                        </p>
                        {doc.type === 'resume' && typeof doc.score === 'number' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] border border-white/10 bg-white/5 text-white/70">
                            {doc.score}/100
                          </span>
                        )}
                        {doc.isMaster && (
                          <span className="px-1.5 py-0.5 bg-[#9333EA]/20 border border-[#9333EA]/30 rounded text-[8px] text-[#C084FC] uppercase">
                            Master
                          </span>
                        )}
                      </div>
                      {doc.subtitle && (
                        <p className="text-xs text-white/50 truncate">{doc.subtitle}</p>
                      )}
                      <p className="text-[10px] text-white/30 mt-1">
                        {new Date(doc.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </button>

                <div className="absolute right-2 top-2">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveMenuId(activeMenuId === doc.id ? null : doc.id);
                    }}
                    className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {activeMenuId === doc.id && (
                    <div
                      className="absolute right-0 mt-2 w-44 rounded-lg border border-white/10 bg-[#0a0e1f] shadow-xl z-20"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="py-1 text-xs text-white/70">
                        {doc.type === 'resume' && (
                          <>
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                onWorkspaceSwitch('tailor', { selectedResumeId: doc.id });
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-white/5"
                            >
                              Tailor resume
                            </button>
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                handleSetMaster(doc);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-white/5"
                            >
                              Set as master
                            </button>
                          </>
                        )}
                        {doc.type === 'job' && (
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              onWorkspaceSwitch('job-analysis', { selectedJobId: doc.id });
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-white/5"
                          >
                            Analyze job
                          </button>
                        )}
                        {doc.type === 'assessment' && (
                          <>
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                window.location.href = `/career-studio/assessment/results?id=${doc.id}`;
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-white/5"
                            >
                              View results
                            </button>
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                onWorkspaceSwitch('assessment');
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-white/5"
                            >
                              Retake assessment
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => {
                            setActiveMenuId(null);
                            handleDelete(doc);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-white/5 text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resume Detail Viewer */}
      {activeTab !== 'jobs' && (
        <div className="border-t border-white/[0.08] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">
              Resume Viewer
            </div>
            {resumeDetail?.id && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onWorkspaceSwitch('resume-manager', { selectedResumeId: resumeDetail.id })}
                  className="text-[11px] text-[#C084FC] hover:text-white transition"
                >
                  Open in Resume Manager →
                </button>
                <button
                  type="button"
                  onClick={handleImportToBuilder}
                  disabled={importingResumeId === resumeDetail.id}
                  className="text-[11px] text-white/70 hover:text-white transition disabled:opacity-50"
                >
                  {importingResumeId === resumeDetail.id ? 'Creating draft…' : 'Create Resume Builder Draft'}
                </button>
              </div>
            )}
          </div>

          {resumeDetailLoading ? (
            <div className="text-xs text-white/40 py-4 text-center">Loading resume…</div>
          ) : !resumeDetail ? (
            <div className="text-xs text-white/40 py-3 text-center">
              Select a resume to view its content and analysis highlights.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-white/80 font-medium truncate">
                    {resumeDetail.fileName}
                  </div>
                  {typeof resumeDetail.overallScore === 'number' && (
                    <div className="text-[11px] text-white/70">
                      Score: <span className="text-white">{resumeDetail.overallScore}/100</span>
                    </div>
                  )}
                </div>
                {resumeDetail.topIssues.length > 0 && (
                  <div className="mt-1.5 text-[11px] text-white/60">
                    Top issues: {resumeDetail.topIssues.join(' • ')}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-white/10 bg-black/20 max-h-56 overflow-auto p-2.5">
                <pre className="whitespace-pre-wrap text-[11px] leading-5 text-white/85">
                  {resumeDetail.rawText || 'No extracted text available yet.'}
                </pre>
              </div>
              {importError && (
                <div className="text-[11px] text-red-300">
                  {importError}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="p-3 border-t border-white/[0.08] space-y-2">
        <button
          onClick={() => onWorkspaceSwitch('job-analysis')}
          className="w-full px-3 py-2 bg-[#9333EA]/10 hover:bg-[#9333EA]/20 border border-[#9333EA]/30 rounded-lg text-[#C084FC] text-sm transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Analyze Job
        </button>

        <button
          onClick={() => onWorkspaceSwitch('resume-manager')}
          className="w-full px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-lg text-white/70 text-sm transition-colors flex items-center justify-center gap-2"
        >
          <FileText className="w-4 h-4" />
          Upload Resume
        </button>

        <button
          onClick={() => onWorkspaceSwitch('assessment')}
          className="w-full px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-lg text-white/70 text-sm transition-colors flex items-center justify-center gap-2"
        >
          <Target className="w-4 h-4" />
          Career Assessment
        </button>
      </div>
    </div>
  );
}

// Tab button component
function TabButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-[10px] transition-colors ${
        active
          ? 'bg-[#9333EA]/20 text-[#C084FC] border border-[#9333EA]/30'
          : 'bg-white/[0.03] text-white/50 border border-transparent hover:text-white/70'
      }`}
    >
      {children}
    </button>
  );
}
