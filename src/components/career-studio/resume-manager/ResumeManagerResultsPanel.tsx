'use client';

import type { ResumeManagerResultsPanelData } from './ResumeManagerPanelContext';

interface ResumeManagerResultsPanelProps {
  data: ResumeManagerResultsPanelData;
}

export default function ResumeManagerResultsPanel({ data }: ResumeManagerResultsPanelProps) {
  return (
    <section className="flex flex-col h-full">
      <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl p-3 flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wider text-white/40">
            Draft (Editable)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={data.onResetDraft}
              className="text-[10px] text-white/60 hover:text-white transition"
            >
              Reset Draft
            </button>
            <button
              type="button"
              onClick={data.onSaveDraft}
              disabled={data.draftSaving || !data.draftResumeText.trim()}
              className="px-2.5 py-1 rounded border border-white/15 bg-white/5 text-[10px] text-white/80 hover:bg-white/10 transition disabled:opacity-50"
            >
              {data.draftSaving ? 'Saving...' : 'Save Draft'}
            </button>
          </div>
        </div>
        {data.originalResumeText ? (
          <>
            <textarea
              value={data.draftResumeText}
              onChange={(e) => data.onDraftChange(e.target.value)}
              className="flex-1 min-h-[520px] rounded-lg border border-white/10 bg-black/20 p-3 text-[12px] text-white/90 placeholder-white/30 focus:outline-none focus:border-[#9333EA]/50"
            />
            {data.draftSaveError && (
              <div className="text-[11px] text-red-300 mt-2">{data.draftSaveError}</div>
            )}
            {data.draftDirty && (
              <div className="text-[10px] text-white/40 mt-1">Unsaved changes</div>
            )}
          </>
        ) : (
          <div className="text-[10px] text-white/40">
            Resume text not available yet. Upload or re-analyze to enable editing.
          </div>
        )}
      </div>
    </section>
  );
}
