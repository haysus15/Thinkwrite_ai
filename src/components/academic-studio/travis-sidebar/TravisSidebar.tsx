// src/components/academic-studio/travis-sidebar/TravisSidebar.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarCheck,
  ListChecks,
  Plus,
  FileText,
} from "lucide-react";
import type { AssignmentRow } from "@/types/academic-studio";

export default function TravisSidebar() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [upcomingAssignments, setUpcomingAssignments] = useState<
    AssignmentRow[]
  >([]);
  const [overdueAssignments, setOverdueAssignments] = useState<AssignmentRow[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedSyllabusId, setParsedSyllabusId] = useState<string | null>(null);
  const [parsedAssignments, setParsedAssignments] = useState(0);

  const loadAssignments = async () => {
    setLoading(true);
    setError(null);
    try {
      const [upcomingRes, overdueRes] = await Promise.all([
        fetch("/api/travis/assignments/upcoming"),
        fetch("/api/travis/assignments/overdue"),
      ]);
      const upcomingData = await upcomingRes.json();
      const overdueData = await overdueRes.json();
      if (!upcomingRes.ok) {
        throw new Error(upcomingData.error || "Failed to load upcoming.");
      }
      if (!overdueRes.ok) {
        throw new Error(overdueData.error || "Failed to load overdue.");
      }
      setUpcomingAssignments(upcomingData.assignments || []);
      setOverdueAssignments(overdueData.assignments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assignments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/travis/syllabus/upload", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Upload failed.");
      }
      setParsedSyllabusId(data.syllabus.id);
      setParsedAssignments(data.assignmentsFound || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {/* Travis avatar header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full border border-teal-400/30 bg-gradient-to-br from-teal-500/40 to-emerald-700/40 shadow-[0_0_15px_rgba(20,184,166,0.3)]" />
        <div>
          <p className="text-sm font-semibold text-slate-100">Travis</p>
          <p className="text-xs text-slate-400">Keeping track</p>
        </div>
      </div>

      {/* Overdue assignments alert */}
      {overdueAssignments.length > 0 && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/8 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-200">
            <AlertTriangle className="h-4 w-4" />
            Overdue
          </div>
          <div className="mt-3 space-y-2 text-sm text-slate-100">
            {overdueAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="academic-assignment-card-overdue rounded-lg px-3 py-3"
              >
                <p className="text-sm font-semibold">
                  {assignment.assignment_name}
                </p>
                <p className="text-xs text-red-100/80">
                  {assignment.class_name}
                </p>
                <p className="mt-1 text-xs text-red-100/70">
                  {assignment.due_date
                    ? new Date(assignment.due_date).toLocaleDateString()
                    : "No due date"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming assignments */}
      <div className="mt-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.25em] text-slate-400">
          <CalendarCheck className="h-4 w-4 text-teal-300" />
          Upcoming
        </div>
        <div className="mt-3 space-y-2 text-sm text-slate-100">
          {loading && (
            <div className="academic-nested-card text-xs text-slate-400">
              Loading assignments...
            </div>
          )}
          {!loading && upcomingAssignments.length === 0 && (
            <div className="academic-nested-card text-xs text-slate-400">
              No upcoming deadlines.
            </div>
          )}
          {upcomingAssignments.map((assignment) => (
            <div key={assignment.id} className="academic-assignment-card">
              <p className="text-sm font-semibold">
                {assignment.assignment_name}
              </p>
              <p className="text-xs text-slate-400">{assignment.class_name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {assignment.due_date
                  ? new Date(assignment.due_date).toLocaleDateString()
                  : "No due date"}
              </p>
              {assignment.assignment_type === "paper" && (
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/academic-studio/dashboard?workspace=paper-workflow&assignmentId=${assignment.id}`
                    )
                  }
                  className="mt-2 inline-flex items-center gap-2 rounded-full border border-teal-400/40 bg-teal-500/15 px-3 py-1 text-xs text-teal-200 transition hover:bg-teal-500/25"
                >
                  <FileText className="h-3 w-3" />
                  Start paper
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-6 border-t border-white/8 pt-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.25em] text-slate-400">
          <ListChecks className="h-4 w-4 text-slate-300" />
          Quick actions
        </div>
        <div className="mt-3 space-y-2 text-sm text-slate-300">
          <button
            type="button"
            className="academic-nested-card-interactive flex w-full items-center justify-between text-left"
          >
            Add assignment
            <Plus className="h-4 w-4 text-teal-300" />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="academic-nested-card-interactive flex w-full items-center justify-between text-left"
          >
            Upload syllabus
            <Plus className="h-4 w-4 text-teal-300" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) {
                handleUpload(selected);
              }
            }}
          />
          {uploading && (
            <p className="text-xs text-slate-500">Parsing syllabus...</p>
          )}
          {parsedSyllabusId && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const response = await fetch(
                    `/api/travis/syllabus/confirm/${parsedSyllabusId}`,
                    { method: "POST" }
                  );
                  const data = await response.json();
                  if (!response.ok) {
                    throw new Error(data.error || "Confirm failed.");
                  }
                  setParsedSyllabusId(null);
                  setParsedAssignments(0);
                  loadAssignments();
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Confirm failed."
                  );
                }
              }}
              className="flex w-full items-center justify-between rounded-xl border border-teal-400/40 bg-teal-500/15 px-3 py-3 text-left text-xs text-teal-200 transition hover:bg-teal-500/25"
            >
              Confirm {parsedAssignments} assignments
              <Plus className="h-4 w-4" />
            </button>
          )}
          {error && (
            <p role="alert" className="text-xs text-red-300">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
