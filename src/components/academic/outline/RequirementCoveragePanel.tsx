"use client";

import { CheckCircle2, Circle } from "lucide-react";
import type {
  OutlineDraft,
  ParsedRequirements,
  RequirementCoverage,
} from "./outlineTypes";

interface RequirementCoveragePanelProps {
  draft: OutlineDraft;
  requirements: ParsedRequirements | null;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function computeCoverage(
  draft: OutlineDraft,
  requirements: ParsedRequirements | null
): RequirementCoverage[] {
  if (!requirements) return [];

  const items: RequirementCoverage[] = [];

  if (requirements.minSections) {
    items.push({
      label: `Minimum ${requirements.minSections} sections — you have ${draft.sections.length}`,
      covered: draft.sections.length >= requirements.minSections,
    });
  }

  if (requirements.requiredTopics?.length) {
    requirements.requiredTopics.forEach((topic) => {
      const covered = draft.sections.some(
        (section) =>
          section.title.toLowerCase().includes(topic.toLowerCase()) ||
          section.keyPoints.some((point) =>
            point.toLowerCase().includes(topic.toLowerCase())
          )
      );
      items.push({
        label: `Required topic: ${topic}`,
        covered,
      });
    });
  }

  const hasCounterargument = draft.sections.some((section) => section.fromGoal === 3);
  if (
    requirements.requiredTopics?.some((topic) =>
      topic.toLowerCase().includes("counter")
    )
  ) {
    items.push({
      label: "Counterargument addressed",
      covered: hasCounterargument,
    });
  }

  if (requirements.minSources) {
    items.push({
      label: `Sources required: ${requirements.minSources}${
        requirements.citationFormat ? ` (${requirements.citationFormat})` : ""
      } — added after outline approval`,
      covered: false,
    });
  }

  if (requirements.dueDate) {
    items.push({
      label: `Due: ${formatDate(requirements.dueDate)}`,
      covered: true,
    });
  }

  return items;
}

export default function RequirementCoveragePanel({
  draft,
  requirements,
}: RequirementCoveragePanelProps) {
  const items = computeCoverage(draft, requirements);
  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
        Requirement coverage
      </p>
      <div className="mt-3 space-y-2">
        {items.map((item) => {
          const isInformational =
            item.label.startsWith("Sources required:") || item.label.startsWith("Due:");
          return (
            <div
              key={item.label}
              className={`flex items-start gap-3 rounded-xl px-3 py-2 ${
                item.covered || isInformational ? "bg-white/[0.04]" : "bg-white/[0.02]"
              } ${item.covered || isInformational ? "opacity-100" : "opacity-75"}`}
            >
              {item.covered || isInformational ? (
                <CheckCircle2
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    isInformational ? "text-slate-400" : "text-emerald-300"
                  }`}
                />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
              )}
              <p className="text-sm text-slate-200">{item.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
