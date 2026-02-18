'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { ResumeManagerResultsPanelData } from './ResumeManagerPanelContext';

interface ResumeManagerResultsPanelProps {
  data: ResumeManagerResultsPanelData;
}

export default function ResumeManagerResultsPanel({ data }: ResumeManagerResultsPanelProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const editingRef = useRef(false);

  const highlightMap = useMemo(() => {
    const suggestions = data.inlineSuggestions || [];
    if (!suggestions.length) return [];
    return suggestions
      .filter((s) => s.currentLine && s.suggestedFix)
      .map((s) => ({
        id: s.id,
        currentLine: s.currentLine.trim(),
      }));
  }, [data.inlineSuggestions]);

  const highlightedHtml = useMemo(() => {
    if (!highlightMap.length) return null;
    let html = data.draftResumeText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    highlightMap.forEach((item) => {
      if (!item.currentLine) return;
      const escaped = item.currentLine
        .replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escaped);
      html = html.replace(
        regex,
        `<mark class="tw-inline-suggestion" data-id="${item.id}">${item.currentLine}</mark>`
      );
    });

    return html.replace(/\n/g, '<br/>');
  }, [data.draftResumeText, highlightMap]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (document.activeElement === editor && editingRef.current) {
      return;
    }
    const html = highlightedHtml ?? data.draftResumeText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');
    editor.innerHTML = html;
  }, [data.draftResumeText, highlightedHtml]);

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
              className="text-[10px] text-[#A855F7]/80 hover:text-[#C084FC] transition"
            >
              Reset Draft
            </button>
            <button
              type="button"
              onClick={data.onSaveDraft}
              disabled={data.draftSaving || !data.draftResumeText.trim()}
              className="career-btn-primary px-2.5 py-1 rounded text-[10px] disabled:opacity-50"
            >
              {data.draftSaving ? 'Saving...' : 'Save Draft'}
            </button>
          </div>
        </div>
        {data.originalResumeText ? (
          <>
            <div className="relative flex-1 min-h-[520px] rounded-lg border border-white/10 bg-black/20 overflow-hidden">
              <div
                ref={editorRef}
                role="textbox"
                contentEditable
                suppressContentEditableWarning
                onFocus={() => {
                  editingRef.current = true;
                }}
                onBlur={() => {
                  editingRef.current = false;
                }}
                onInput={(e) => {
                  const text = e.currentTarget.textContent ?? '';
                  data.onDraftChange(text);
                }}
                className="h-full w-full overflow-y-auto whitespace-pre-wrap break-words p-3 text-[12px] leading-[1.6] text-white/90 focus:outline-none"
                style={{
                  caretColor: 'white',
                }}
              />
            </div>
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
