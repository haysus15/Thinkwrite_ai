"use client";

import React, { useMemo } from "react";

interface SavedAnalysis {
  id: string;
  job_title: string;
  company_name: string;
  location?: string;
  is_saved: boolean;
  has_applied: boolean;
  application_email?: string;
  created_at: string;
  hidden_insights?: {
    phraseTranslations?: Array<{ original: string; meaning: string }>;
  };
}

interface SavedAnalysesSidebarProps {
  analyses: SavedAnalysis[];
  onSelect: (analysisId: string) => void;
  onMarkApplied: (analysisId: string) => void;
  onDiscussWithLex: (analysisId: string) => void;
  onDelete?: (analysisId: string) => void;
}

export default function SavedAnalysesSidebarV2({
  analyses,
  onSelect,
  onMarkApplied,
  onDiscussWithLex,
  onDelete,
}: SavedAnalysesSidebarProps) {
  const savedAnalyses = useMemo(() => {
    const list = (analyses || []).filter((a) => a.is_saved);
    // newest-first
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list;
  }, [analyses]);

  if (savedAnalyses.length === 0) {
    return (
      <div className="text-center text-white/60 py-8">
        <div className="text-3xl mb-3"></div>
        <p className="text-sm">No saved analyses yet</p>
        <p className="text-xs mt-1 text-white/40">Analyze jobs and save them for later reference</p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getConcernCount = (analysis: SavedAnalysis): number => {
    // safe guard for older rows
    const n = analysis.hidden_insights?.phraseTranslations?.length;
    return typeof n === "number" ? n : 0;
  };

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {savedAnalyses.map((analysis) => {
        const concernCount = getConcernCount(analysis);

        return (
          <div
            key={analysis.id}
            className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 hover:bg-white/[0.04] transition-colors group"
          >
            {/* Header */}
            <button
              type="button"
              onClick={() => onSelect(analysis.id)}
              className="w-full text-left"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium text-sm truncate group-hover:text-[#9333EA] transition-colors">
                    {analysis.job_title}
                  </h4>
                  <p className="text-white/60 text-xs truncate">{analysis.company_name}</p>
                  {analysis.location && <p className="text-white/40 text-xs truncate">{analysis.location}</p>}
                </div>

                {analysis.has_applied && (
                  <div className="flex items-center space-x-1 ml-2">
                    <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-xs text-emerald-400">Applied</span>
                  </div>
                )}
              </div>
            </button>

            {/* Indicators */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                {concernCount > 0 && (
                  <div className="flex items-center space-x-1">
                    <span className="text-orange-400 text-xs">️</span>
                    <span className="text-orange-400 text-xs">
                      {concernCount} concern{concernCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}

                {analysis.application_email && (
                  <div className="flex items-center space-x-1">
                    <span className="text-emerald-400 text-xs">️</span>
                    <span className="text-emerald-400 text-xs">Email</span>
                  </div>
                )}
              </div>

              <span className="text-white/40 text-xs">{formatDate(analysis.created_at)}</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(analysis.id);
                }}
                className="px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-white text-xs rounded-lg transition-colors"
              >
                View
              </button>

              {!analysis.has_applied && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkApplied(analysis.id);
                  }}
                  className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs rounded-lg transition-colors"
                >
                  Applied
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDiscussWithLex(analysis.id);
                }}
                className="px-3 py-1.5 bg-[#9333EA]/20 hover:bg-[#9333EA]/30 text-[#9333EA] text-xs rounded-lg transition-colors"
              >
                Lex
              </button>

              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(analysis.id);
                  }}
                  className="ml-auto px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs rounded-lg transition-colors"
                  title="Delete this analysis"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        );
      })}

      <div className="mt-4 pt-4 border-t border-white/[0.05]">
        <div className="text-center space-y-1">
          <p className="text-xs text-white/60">
            {savedAnalyses.length} saved • {savedAnalyses.filter((a) => a.has_applied).length} applied
          </p>
          <p className="text-xs text-white/40">
            {savedAnalyses.filter((a) => a.application_email).length} with email applications
          </p>
        </div>
      </div>
    </div>
  );
}
