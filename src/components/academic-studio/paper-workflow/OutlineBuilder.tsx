// src/components/academic-studio/paper-workflow/OutlineBuilder.tsx
"use client";

import { useMemo, useState } from "react";
import { ArrowRight, FilePlus, MessageSquare } from "lucide-react";
import { useVictorChat } from "../victor-chat/VictorChatContext";

interface OutlineBuilderProps {
  onContinue: (outlineId: string) => void;
}

type OutlineSection = {
  title: string;
  mainPoints: string;
};

export default function OutlineBuilder({ onContinue }: OutlineBuilderProps) {
  const { messages } = useVictorChat();
  const latestVictorMessage = useMemo(() => {
    return [...messages].reverse().find((message) => message.role === "assistant");
  }, [messages]);
  const [unlocked, setUnlocked] = useState(false);
  const [savedOutlineId, setSavedOutlineId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [assignmentType, setAssignmentType] = useState("");
  const [className, setClassName] = useState("");
  const [thesis, setThesis] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [sections, setSections] = useState<OutlineSection[]>([
    { title: "", mainPoints: "" },
    { title: "", mainPoints: "" },
    { title: "", mainPoints: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseVictorOutline = (text: string) => {
    const getLine = (label: string) => {
      const match = text.match(new RegExp(`${label}:\\s*(.+)`, "i"));
      return match ? match[1].trim() : "";
    };

    const nextTopic = getLine("Topic");
    const nextThesis = getLine("Thesis");
    const nextConclusion = getLine("Conclusion");
    const nextClass = getLine("Class");
    const nextAssignmentType = getLine("Assignment type");
    const nextSections = [1, 2, 3].map((index) => ({
      title: getLine(`Section ${index}`),
      mainPoints: getLine(`Section ${index} points`) || "",
    }));

    return {
      topic: nextTopic,
      thesis: nextThesis,
      conclusion: nextConclusion,
      className: nextClass,
      assignmentType: nextAssignmentType,
      sections: nextSections,
    };
  };

  const applyVictorOutline = () => {
    if (!latestVictorMessage?.content) return;
    const parsed = parseVictorOutline(latestVictorMessage.content);
    if (parsed.topic) setTopic(parsed.topic);
    if (parsed.thesis) setThesis(parsed.thesis);
    if (parsed.conclusion) setConclusion(parsed.conclusion);
    if (parsed.className) setClassName(parsed.className);
    if (parsed.assignmentType) setAssignmentType(parsed.assignmentType);
    if (parsed.sections.some((section) => section.title || section.mainPoints)) {
      setSections((prev) =>
        prev.map((section, index) => ({
          title: parsed.sections[index]?.title || section.title,
          mainPoints: parsed.sections[index]?.mainPoints || section.mainPoints,
        }))
      );
    }
    setUnlocked(true);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-slate-200">
        <span className="font-semibold text-sky-200">Step 1:</span> Work with
        Victor on the left to sharpen the claim and key points.{" "}
        <span className="font-semibold text-sky-200">Step 2:</span> The outline
        form unlocks after Victor responds.
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-sky-300" />
            <p className="text-sm font-semibold text-slate-100">
              Step 1: Victor outline session
            </p>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3">
              Victor: {latestVictorMessage?.content || "Waiting for Victor's response."}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={applyVictorOutline}
                disabled={!latestVictorMessage}
                className="rounded-full border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-xs text-sky-200 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Use Victor outline
              </button>
              {!latestVictorMessage && (
                <span className="text-xs text-slate-500">
                  Waiting for Victor's response.
                </span>
              )}
              {unlocked && (
                <span className="text-xs text-emerald-300">
                  Outline unlocked. Review and edit.
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-3">
            <FilePlus className="h-5 w-5 text-slate-200" />
            <p className="text-sm font-semibold text-slate-100">
              Step 2: Outline details
            </p>
          </div>
          {!unlocked && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
              Waiting for Victor's response to unlock the outline form.
            </div>
          )}
          {unlocked && (
            <div className="mt-4 space-y-4 text-sm text-slate-300">
            <label className="block">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Topic
              </span>
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Enter your thesis or topic"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Class
              </span>
              <input
                value={className}
                onChange={(event) => setClassName(event.target.value)}
                placeholder="Course or professor"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Assignment type
              </span>
              <input
                value={assignmentType}
                onChange={(event) => setAssignmentType(event.target.value)}
                placeholder="Essay, research paper, lab report"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
              />
            </label>
          </div>
          )}
        </div>
      </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm font-semibold text-slate-100">
            Outline structure
          </p>
        <p className="mt-2 text-sm text-slate-400">
          Victor will force clarity on thesis, section logic, and counterpoints.
        </p>
        {!unlocked && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
            Waiting for Victor's response to unlock outline structure.
          </div>
        )}
        {unlocked && (
          <>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Thesis
            </span>
            <textarea
              value={thesis}
              onChange={(event) => setThesis(event.target.value)}
              rows={3}
              placeholder="State the argument you will defend."
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Conclusion
            </span>
            <textarea
              value={conclusion}
              onChange={(event) => setConclusion(event.target.value)}
              rows={3}
              placeholder="Summarize the landing point."
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
            />
          </label>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
          {sections.map((section, index) => (
            <div
              key={`section-${index}`}
              className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300"
            >
              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Section {index + 1}
                </span>
                <input
                  value={section.title}
                  onChange={(event) => {
                    const next = [...sections];
                    next[index] = { ...next[index], title: event.target.value };
                    setSections(next);
                  }}
                  placeholder="Section title"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                />
              </label>
              <label className="mt-3 block">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Main points
                </span>
                <textarea
                  value={section.mainPoints}
                  onChange={(event) => {
                    const next = [...sections];
                    next[index] = {
                      ...next[index],
                      mainPoints: event.target.value,
                    };
                    setSections(next);
                  }}
                  rows={3}
                  placeholder="Key evidence, bullets, or logic."
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                />
              </label>
            </div>
          ))}
            </div>
          </>
        )}
        {error && (
          <p className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={async () => {
            if (!topic.trim() || !thesis.trim()) {
              setError("Add a topic and thesis before saving.");
              return;
            }
            setError(null);
            setSaving(true);
            try {
              const response = await fetch("/api/academic/outline/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  topic,
                  assignmentType,
                  className,
                  outline: {
                    thesis,
                    sections: sections.map((section) => ({
                      title: section.title,
                      main_points: section.mainPoints
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean),
                      evidence: [],
                    })),
                    conclusion,
                  },
                }),
              });
              const data = await response.json();
              if (!response.ok) {
                throw new Error(data.error || "Failed to save outline.");
              }
              setSavedOutlineId(data.outlineId);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Save failed.");
            } finally {
              setSaving(false);
            }
          }}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 px-5 py-2 text-sm text-sky-200 transition hover:border-sky-300/70 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save outline"}
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => savedOutlineId && onContinue(savedOutlineId)}
          disabled={!savedOutlineId}
          className="ml-3 mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-5 py-2 text-sm text-emerald-200 transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          Continue to generate
        </button>
      </div>
    </div>
  );
}
