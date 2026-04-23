"use client";

import { useTranslations } from "next-intl";
import { Layers } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { sql } from "@codemirror/lang-sql";
import { javascript } from "@codemirror/lang-javascript";
import type { CodingLanguage } from "../hooks/useCodingReview";

type CodeEditorProps = {
  language: CodingLanguage;
  code: string;
  templateQuery: string;
  templates: Array<{ key: string; label: string }>;
  recentTemplates: string[];
  readOnly?: boolean;
  onChangeCode: (value: string) => void;
  onChangeTemplateQuery: (value: string) => void;
  onLoadTemplate: (key: string) => void | Promise<void>;
};

export default function CodeEditor({
  language,
  code,
  templateQuery,
  templates,
  recentTemplates,
  readOnly = false,
  onChangeCode,
  onChangeTemplateQuery,
  onLoadTemplate,
}: CodeEditorProps) {
  const t = useTranslations("academic.codeReviewMode.editor");
  return (
    <div className="coding-review-editor border-b border-white/10 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.25em] text-slate-400">
        <span>{t("title")}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">{t("scratchpad")}</span>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                const panel = document.getElementById("coding-review-template-menu");
                if (panel) panel.toggleAttribute("data-open");
              }}
              data-template-toggle
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] text-slate-200 transition hover:bg-white/10"
            >
              <Layers className="h-3 w-3" />
              {t("templates")}
            </button>
            <div
              id="coding-review-template-menu"
              data-open={false}
              className="absolute right-0 z-20 mt-2 hidden w-64 rounded-xl border border-white/10 bg-slate-900/95 p-2 text-xs text-slate-200 shadow-xl data-[open=true]:block"
            >
              <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                {t("templates")}
              </p>
              <div className="px-2 pb-2">
                <input
                  value={templateQuery}
                  onChange={(event) => onChangeTemplateQuery(event.target.value)}
                  placeholder={t("searchTemplates")}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500"
                />
              </div>
              {recentTemplates.length > 0 && (
                <div className="px-2 pb-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  {t("recent")}
                </div>
              )}
              {recentTemplates
                .map((key) => {
                  const item = templates.find((tpl) => tpl.key === key);
                  return item ? { key: item.key, label: item.label } : null;
                })
                .filter(Boolean)
                .map((item) => (
                  <button
                    key={`recent-${item!.key}`}
                    type="button"
                    onClick={() => {
                      onLoadTemplate(item!.key);
                      const panel = document.getElementById("coding-review-template-menu");
                      panel?.removeAttribute("data-open");
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs text-amber-100 hover:bg-white/5"
                  >
                    {item!.label}
                  </button>
                ))}
              {templates.map((item) =>
                templateQuery &&
                !item.label.toLowerCase().includes(templateQuery.toLowerCase()) ? null : (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onLoadTemplate(item.key);
                      const panel = document.getElementById("coding-review-template-menu");
                      panel?.removeAttribute("data-open");
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs text-slate-200 hover:bg-white/5"
                  >
                    {item.label}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="h-full min-h-[240px] flex-1 bg-slate-950/40">
        <CodeMirror
          value={code}
          height="100%"
          theme="dark"
          editable={!readOnly}
          extensions={[
            language === "python"
              ? python()
              : language === "sql"
                ? sql()
                : javascript({ jsx: true }),
          ]}
          onChange={onChangeCode}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            bracketMatching: true,
            foldGutter: false,
          }}
          className="h-full text-xs"
        />
      </div>
    </div>
  );
}
