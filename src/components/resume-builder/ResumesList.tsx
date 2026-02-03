"use client";

import { useState, useEffect } from "react";
import { ResumeCard } from "./ResumeCard";

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

export function ResumesList() {
  const [resumes, setResumes] = useState<ResumeDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchResumes();
  }, []);

  const fetchResumes = async () => {
    try {
      const res = await fetch("/api/resume-builder/list");
      const data = await res.json();
      if (data.success) {
        setResumes(data.resumes);
      }
    } catch (err) {
      console.error("Failed to fetch resumes:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this resume draft?")) return;

    const res = await fetch(`/api/resume-builder/draft/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      setResumes((prev) => prev.filter((r) => r.id !== id));
    }
  };

  if (isLoading) {
    return <div className="text-white/50">Loading your resumes...</div>;
  }

  if (resumes.length === 0) {
    return (
      <div className="text-center py-16 rounded-xl border border-dashed border-white/20 bg-black/20">
        <p className="text-white/70 mb-4">No resumes yet</p>
        <a
          href="/career-studio/resume-builder/guided"
          className="text-violet-300 hover:text-violet-200 transition"
        >
          Build your first resume with Lex →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {resumes.map((resume) => (
        <ResumeCard key={resume.id} resume={resume} onDelete={handleDelete} />
      ))}
    </div>
  );
}
