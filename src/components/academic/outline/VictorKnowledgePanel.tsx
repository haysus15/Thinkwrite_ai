"use client";

import { useEffect, useState } from "react";
import type { StudentAcademicProfile } from "./outlineTypes";
import AcademicLoadingState from "../shared/AcademicLoadingState";
import AcademicErrorState from "../shared/AcademicErrorState";

interface VictorKnowledgePanelProps {
  userId: string;
  onClose: () => void;
}

export default function VictorKnowledgePanel({
  userId: _userId,
  onClose,
}: VictorKnowledgePanelProps) {
  const [profile, setProfile] = useState<StudentAcademicProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [overrides, setOverrides] = useState<StudentAcademicProfile["overridePatterns"]>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/academic/student-profile")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Could not load Victor's profile.");
        }
        if (!active) return;
        setProfile(data as StudentAcademicProfile);
        setOverrides((data as StudentAcademicProfile).overridePatterns ?? {});
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load profile.");
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSaveOverrides = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/academic/student-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileOverrides: overrides }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Could not save profile overrides.");
      }
      setProfile((current) =>
        current
          ? {
              ...current,
              overridePatterns: overrides,
              thesisStrength: overrides.thesisStrength ?? current.thesisStrength,
              counterargumentStrength:
                overrides.counterargumentStrength ?? current.counterargumentStrength,
              conclusionStrength:
                overrides.conclusionStrength ?? current.conclusionStrength,
            }
          : current
      );
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/academic/student-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileOverrides: {} }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Could not clear profile overrides.");
      }
      setOverrides({});
      setProfile((current) =>
        current
          ? {
              ...current,
              overridePatterns: {},
            }
          : current
      );
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Could not clear profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!profile && !error) {
    return <AcademicLoadingState message="Loading Victor's profile..." />;
  }

  if (error && !profile) {
    return <AcademicErrorState message={error} className="!min-h-0 py-3" />;
  }

  if (!profile) return null;

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/95 p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            What Victor knows about you
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-100">Academic profile</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300"
        >
          Close
        </button>
      </div>

      <div className="mt-4 space-y-4 text-sm text-slate-200">
        <p>
          <strong>Papers completed:</strong> {profile.papersCompleted}
        </p>

        {profile.classesWorkedIn.length > 0 ? (
          <p>
            <strong>Classes:</strong> {profile.classesWorkedIn.join(", ")}
          </p>
        ) : null}

        {profile.papersCompleted > 0 ? (
          <>
            <div>
              <p className="font-medium text-slate-100">Typically strong:</p>
              <ul className="mt-2 space-y-1 text-slate-300">
                {profile.thesisStrength === "strong" ? <li>Thesis statements</li> : null}
                {profile.counterargumentStrength === "strong" ? <li>Counterarguments</li> : null}
                {profile.conclusionStrength === "strong" ? <li>Conclusions</li> : null}
              </ul>
            </div>

            <div>
              <p className="font-medium text-slate-100">Worth extra time:</p>
              <ul className="mt-2 space-y-1 text-slate-300">
                {profile.thesisStrength === "needs_support" ? <li>Thesis strength</li> : null}
                {profile.counterargumentStrength === "needs_scaffolding" ? (
                  <li>Counterargument identification</li>
                ) : null}
                {profile.conclusionStrength === "needs_support" ? (
                  <li>Conclusion development</li>
                ) : null}
              </ul>
            </div>
          </>
        ) : (
          <p className="text-slate-400">
            Victor will learn your patterns as you complete more papers.
          </p>
        )}

        {profile.lastFivePapers.length > 0 ? (
          <div>
            <p className="font-medium text-slate-100">Recent papers:</p>
            <ul className="mt-2 space-y-1 text-slate-300">
              {profile.lastFivePapers.map((paper, index) => (
                <li key={`${paper.topic}-${index}`}>
                  {paper.topic}
                  {paper.className ? ` — ${paper.className}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-5 space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm text-slate-200">Correct Victor's assessment of your strengths:</p>
          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Thesis statements
            </span>
            <select
              value={overrides.thesisStrength ?? profile.thesisStrength}
              onChange={(event) =>
                setOverrides((current) => ({
                  ...current,
                  thesisStrength: event.target.value as "strong" | "needs_support",
                }))
              }
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
            >
              <option value="strong">Strong</option>
              <option value="needs_support">Needs support</option>
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Counterarguments
            </span>
            <select
              value={overrides.counterargumentStrength ?? profile.counterargumentStrength}
              onChange={(event) =>
                setOverrides((current) => ({
                  ...current,
                  counterargumentStrength: event.target.value as
                    | "strong"
                    | "needs_scaffolding",
                }))
              }
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
            >
              <option value="strong">Strong</option>
              <option value="needs_scaffolding">Needs scaffolding</option>
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Conclusions
            </span>
            <select
              value={overrides.conclusionStrength ?? profile.conclusionStrength}
              onChange={(event) =>
                setOverrides((current) => ({
                  ...current,
                  conclusionStrength: event.target.value as
                    | "strong"
                    | "needs_support",
                }))
              }
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
            >
              <option value="strong">Strong</option>
              <option value="needs_support">Needs support</option>
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSaveOverrides()}
              disabled={saving}
              className="rounded-full border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-sm text-sky-200"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => void handleClear()}
            disabled={saving}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
          >
            Clear history
          </button>
        </div>
      )}

      {error ? <AcademicErrorState message={error} className="mt-4 !min-h-0 py-3" /> : null}
    </div>
  );
}
