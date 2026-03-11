"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AcademicShellData = {
  assignmentsDueSoon: number;
  paperInProgress: boolean;
  academicConfidence: number | null;
  refresh: () => Promise<void>;
};

const AcademicShellDataContext = createContext<AcademicShellData | null>(null);

function toDueSoonCount(assignments: unknown[]): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return assignments.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as { due_date?: string | null; status?: string | null };
    if (!row.due_date) return false;
    if (row.status === "completed" || row.status === "submitted") return false;
    const due = new Date(`${row.due_date}T00:00:00`);
    if (Number.isNaN(due.getTime())) return false;
    const deltaDays = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return deltaDays <= 3;
  }).length;
}

function toConfidencePercent(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

export function AcademicShellDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [assignmentsDueSoon, setAssignmentsDueSoon] = useState(0);
  const [paperInProgress, setPaperInProgress] = useState(false);
  const [academicConfidence, setAcademicConfidence] = useState<number | null>(null);
  const supabase = createSupabaseBrowserClient();

  const refresh = useCallback(async () => {
    if (!user) {
      setAssignmentsDueSoon(0);
      setPaperInProgress(false);
      setAcademicConfidence(null);
      return;
    }

    const [assignmentsResult, papersResult, voiceResult] = await Promise.allSettled([
      fetch("/api/travis/assignments/all?status=active").then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return [];
        return Array.isArray(data?.assignments) ? data.assignments : [];
      }),
      supabase
        .from("academic_papers")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("completed_at", null),
      fetch("/api/mirror-mode/voice/status")
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) return null;
          return data;
        })
        .catch(() => null),
    ]);

    if (assignmentsResult.status === "fulfilled") {
      setAssignmentsDueSoon(toDueSoonCount(assignmentsResult.value));
    } else {
      setAssignmentsDueSoon(0);
    }

    if (papersResult.status === "fulfilled") {
      setPaperInProgress((papersResult.value.count ?? 0) > 0);
    } else {
      setPaperInProgress(false);
    }

    if (voiceResult.status === "fulfilled" && voiceResult.value) {
      const academicScore =
        voiceResult.value?.chamberSummaries?.academic?.confidenceLevel ?? null;
      setAcademicConfidence(toConfidencePercent(academicScore));
    } else {
      setAcademicConfidence(null);
    }
  }, [supabase, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AcademicShellData>(
    () => ({
      assignmentsDueSoon,
      paperInProgress,
      academicConfidence,
      refresh,
    }),
    [academicConfidence, assignmentsDueSoon, paperInProgress, refresh]
  );

  return (
    <AcademicShellDataContext.Provider value={value}>
      {children}
    </AcademicShellDataContext.Provider>
  );
}

export function useAcademicShellData() {
  const context = useContext(AcademicShellDataContext);
  if (context) return context;
  return {
    assignmentsDueSoon: 0,
    paperInProgress: false,
    academicConfidence: null,
    refresh: async () => undefined,
  };
}
