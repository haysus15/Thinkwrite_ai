"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ChallengeCard from "./ChallengeCard";
import CodeSetCompletionPanel from "./CodeSetCompletionPanel";
import type { CodeSetSummary } from "./CodeSetSummaryPanel";

type ChallengeSet = {
  id: string;
  title: string;
  class_name: string | null;
  assignment_prompt: string | null;
  language: string | null;
  status: "in_progress" | "completed" | "abandoned";
};

type SessionItem = {
  id: string;
  set_order: number | null;
  language: string;
  code_snapshot: string | null;
  is_complete: boolean;
  victor_context: unknown;
};

export default function ChallengeSetView({ setId }: { setId: string }) {
  const router = useRouter();
  const [setData, setSetData] = useState<ChallengeSet | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [setSummary, setSetSummary] = useState<CodeSetSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completedCount = useMemo(
    () => sessions.filter((session) => session.is_complete).length,
    [sessions]
  );
  const allComplete = sessions.length > 0 && completedCount === sessions.length;
  const progressPercent = sessions.length === 0 ? 0 : Math.round((completedCount / sessions.length) * 100);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/code-review/challenge-set?id=${setId}&include=sessions`);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load challenge set.");
        }
        if (!active) return;
        setSetData((payload?.set as ChallengeSet) || null);
        const incomingSessions = Array.isArray(payload?.sessions)
          ? (payload.sessions as SessionItem[])
          : [];
        setSessions(
          incomingSessions.sort(
            (a: SessionItem, b: SessionItem) =>
              Number(a.set_order || 0) - Number(b.set_order || 0)
          )
        );
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load challenge set.");
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [setId]);

  useEffect(() => {
    let active = true;
    const loadSummary = async () => {
      if (!allComplete) {
        setSetSummary(null);
        return;
      }
      try {
        const response = await fetch("/api/code-review/set-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challenge_set_id: setId }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Unable to load set summary.");
        }
        if (active) setSetSummary(data as CodeSetSummary);
      } catch (summaryError) {
        if (active) {
          setError(
            summaryError instanceof Error ? summaryError.message : "Unable to load set summary."
          );
        }
      }
    };

    void loadSummary();
    return () => {
      active = false;
    };
  }, [allComplete, setId]);

  const handleSaveSetContext = async (updates: Record<string, unknown>) => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/code-review/challenge-set", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: setId, ...updates }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to update assignment details.");
      }
      setSetData(data.set as ChallengeSet);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to update assignment details."
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-slate-300">Loading challenge set...</p>;
  }

  if (!setData) {
    return <p className="text-sm text-rose-200">Challenge set not found.</p>;
  }

  return (
    <div className="space-y-4">
      <header className="space-y-3 rounded-xl border border-white/10 bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-slate-100">{setData.title}</h2>
            <p className="text-xs text-slate-400">
              {[setData.class_name, setData.language].filter(Boolean).join(" · ") || "No class or language set"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/academic/code-review")}
            className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-slate-200"
          >
            Back to sets
          </button>
        </div>

        {setData.assignment_prompt && (
          <details className="rounded border border-white/10 p-3">
            <summary className="cursor-pointer text-xs text-slate-300">Assignment prompt</summary>
            <p className="mt-2 text-xs text-slate-300">{setData.assignment_prompt}</p>
          </details>
        )}

        <div>
          <p className="text-xs text-slate-300">
            {completedCount} of {sessions.length} challenges complete
          </p>
          <div className="mt-1 h-2 w-full rounded-full bg-slate-800">
            <div className="h-2 rounded-full bg-sky-400/80" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <details className="rounded border border-white/10 p-3">
          <summary className="cursor-pointer text-xs text-slate-300">Assignment details</summary>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <input
              defaultValue={setData.title}
              disabled={allComplete}
              onBlur={(event) =>
                event.target.value.trim() !== setData.title &&
                void handleSaveSetContext({ title: event.target.value.trim() })
              }
              className="rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100"
            />
            <input
              defaultValue={setData.class_name || ""}
              disabled={allComplete}
              onBlur={(event) =>
                event.target.value !== (setData.class_name || "") &&
                void handleSaveSetContext({ class_name: event.target.value })
              }
              className="rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100"
            />
            <input
              defaultValue={setData.language || ""}
              disabled={allComplete}
              onBlur={(event) =>
                event.target.value !== (setData.language || "") &&
                void handleSaveSetContext({ language: event.target.value })
              }
              className="rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100"
            />
            <textarea
              defaultValue={setData.assignment_prompt || ""}
              disabled={allComplete}
              onBlur={(event) =>
                event.target.value !== (setData.assignment_prompt || "") &&
                void handleSaveSetContext({ assignment_prompt: event.target.value })
              }
              rows={3}
              className="rounded border border-white/20 bg-slate-950/30 p-2 text-sm text-slate-100 md:col-span-2"
            />
          </div>
          {isSaving && <p className="mt-2 text-[11px] text-slate-400">Saving...</p>}
        </details>
      </header>

      {!allComplete && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              const target =
                sessions.find((session) => !session.is_complete) || sessions[0];
              if (!target) return;
              router.push(`/academic/code-review/review/${target.id}?setId=${setId}`);
            }}
            className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100"
          >
            Continue coding
          </button>
        </div>
      )}

      {allComplete && setSummary && (
        <CodeSetCompletionPanel
          summary={setSummary}
          sessions={sessions}
          onVictorDebrief={() => {
            const target = sessions[0];
            if (!target) return;
            router.push(`/academic/code-review/review/${target.id}?setId=${setId}&debrief=set`);
          }}
        />
      )}

      <div className="grid gap-2">
        {sessions.map((session) => (
          <ChallengeCard
            key={session.id}
            session={session}
            onOpen={(selected) =>
              router.push(`/academic/code-review/review/${selected.id}?setId=${setId}`)
            }
          />
        ))}
      </div>

      {error && <p className="text-xs text-rose-200">{error}</p>}
    </div>
  );
}
