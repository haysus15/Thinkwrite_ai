"use client";

import { useState } from "react";
import { exportToPdf, exportToDocx } from "@/lib/resume-export";

interface ResumeDraft {
  id: string;
  target_role: string | null;
  status: string;
  sections: Record<string, any>;
  final_content: string | null;
  final_transformed_content: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  resume: ResumeDraft;
  onDelete: (id: string) => void;
}

export function ResumeCard({ resume, onDelete }: Props) {
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);

  const completedSections = Object.keys(resume.sections || {}).filter(
    (k) => resume.sections[k]?.status === "approved"
  );
  const totalSections = 5;
  const progress = Math.round((completedSections.length / totalSections) * 100);

  const isComplete = resume.status === "complete";
  const hasContent = resume.final_content || resume.final_transformed_content;

  const handleExport = async (format: "pdf" | "docx") => {
    if (!hasContent) return;

    setExporting(format);
    try {
      const content =
        resume.final_transformed_content || resume.final_content || "";
      const filename = `resume-${
        resume.target_role?.replace(/\s+/g, "-").toLowerCase() || "draft"
      }`;

      if (format === "pdf") {
        await exportToPdf(content, filename, resume.sections);
      } else {
        await exportToDocx(content, filename, resume.sections);
      }
    } catch (err) {
      console.error(`Export to ${format} failed:`, err);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="career-card p-5 rounded-xl border border-white/10 bg-black/30 text-white">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-white">{resume.target_role || "Untitled Resume"}</h3>
          <div className="flex items-center gap-3 mt-1 text-sm text-white/60">
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                isComplete
                  ? "border border-emerald-400/30 text-emerald-300 bg-emerald-400/10"
                  : "border border-violet-400/30 text-violet-300 bg-violet-400/10"
              }`}
            >
              {isComplete ? "Complete" : "In Progress"}
            </span>
            <span>Updated {new Date(resume.updated_at).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-sm text-white/60">{progress}%</div>
          <div className="w-10 h-10 rounded-full border-2 border-white/15 flex items-center justify-center">
            <svg className="w-10 h-10 -rotate-90">
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-white/10"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={`${progress} 100`}
                className="text-violet-500"
              />
            </svg>
          </div>
        </div>
      </div>

      {completedSections.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {completedSections.map((section) => (
            <span
              key={section}
              className="px-2 py-1 text-xs rounded border border-white/10 bg-black/30 text-white/70"
            >
              {section}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/10">
        {!isComplete ? (
          <a
            href={`/career-studio/resume-builder/guided?draft=${resume.id}`}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-violet-400/30 text-violet-300 hover:text-violet-200 hover:bg-violet-400/10 transition"
          >
            Continue Editing
          </a>
        ) : (
          <>
            <button
              onClick={() => handleExport("pdf")}
              disabled={!hasContent || exporting === "pdf"}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-white/15 text-white/80 hover:text-white hover:bg-white/5 transition disabled:opacity-50"
            >
              {exporting === "pdf" ? "Exporting..." : "Export PDF"}
            </button>
            <button
              onClick={() => handleExport("docx")}
              disabled={!hasContent || exporting === "docx"}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-white/15 text-white/80 hover:text-white hover:bg-white/5 transition disabled:opacity-50"
            >
              {exporting === "docx" ? "Exporting..." : "Export DOCX"}
            </button>
          </>
        )}
        <button
          onClick={() => onDelete(resume.id)}
          className="px-3 py-1.5 text-sm rounded-lg ml-auto border border-red-400/20 text-red-300 hover:text-red-200 hover:bg-red-400/10 transition"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
