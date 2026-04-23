"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { EditableField } from "./EditableField";
import RequirementCoveragePanel from "./RequirementCoveragePanel";
import { stripNumberPrefix } from "@/lib/academic/outlineText";
import type {
  OutlineDraft,
  OutlineDraftSection,
  OutlineStructure,
  ParsedRequirements,
} from "./outlineTypes";
import { draftToOutlineStructure } from "./outlineTypes";

interface OutlineEditorProps {
  draft: OutlineDraft;
  requirements: ParsedRequirements | null;
  voiceAvailable: boolean;
  onUpdate: (updated: OutlineDraft) => void;
  onApprove: (approved: OutlineStructure) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}

interface KeyPointRowProps {
  value: string;
  onChange: (value: string) => void;
  onDelete: () => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  canDelete: boolean;
}

interface SectionCardProps {
  section: OutlineDraftSection;
  index: number;
  isCounterargument: boolean;
  onUpdate: (updated: OutlineDraftSection) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
}

function isApproveEnabled(draft: OutlineDraft): boolean {
  if (!draft.thesis || draft.thesis.trim().length === 0) return false;
  if (draft.sections.length < 2) return false;
  if (
    draft.sections.some(
      (section) =>
        section.keyPoints.filter((point) => point.trim().length > 0).length === 0
    )
  ) {
    return false;
  }
  return true;
}

function getOutlineQualityWarnings(draft: OutlineDraft): string[] {
  const warnings: string[] = [];

  if (draft.sections.length < 2) {
    warnings.push("Add at least two sections to build a complete argument.");
    return warnings;
  }

  const thinSections = draft.sections.filter(
    (section) => section.keyPoints.filter((point) => point.trim().length > 5).length < 1
  );

  if (thinSections.length === 1) {
    warnings.push(
      `The "${stripNumberPrefix(thinSections[0].title || "Untitled section")}" section has no key points yet — add at least one supporting detail.`
    );
  } else if (thinSections.length > 1) {
    warnings.push(
      `${thinSections.length} sections have no key points yet. Add supporting details to each section before approving.`
    );
  }

  if (!draft.thesis || draft.thesis.trim().length < 20) {
    warnings.push(
      "Your central argument looks incomplete — make sure it states a clear position."
    );
  }

  const hasCounterargument = draft.sections.some(
    (section) =>
      section.fromGoal === 3 ||
      section.title.toLowerCase().includes("counterargument")
  );
  if (!hasCounterargument) {
    warnings.push("No counterargument section — adding one strengthens your argument.");
  }

  return warnings;
}

function getBlockingIssues(
  draft: OutlineDraft,
  requirements: ParsedRequirements | null
): string[] {
  const blockingIssues: string[] = [];
  const sourcesRequired = (requirements?.minSources ?? 0) > 0;
  const sourcesDiscussed =
    Array.isArray(draft.sourceContext) && draft.sourceContext.length > 0;

  if (sourcesRequired && !sourcesDiscussed) {
    blockingIssues.push(
      `This assignment requires ${requirements?.minSources} sources. Victor will ask about sources during the outline conversation — complete that step before approving.`
    );
  }

  return blockingIssues;
}

function KeyPointRow({
  value,
  onChange,
  onDelete,
  onEditStart,
  onEditEnd,
  canDelete,
}: KeyPointRowProps) {
  return (
    <div className="group flex items-start gap-2">
      <span className="pt-1 text-sm text-white/30">•</span>
      <EditableField
        value={value}
        placeholder="Key point"
        onChange={onChange}
        onEditStart={onEditStart}
        onEditEnd={onEditEnd}
        className="min-h-[28px] flex-1 text-sm leading-6 text-white/70"
      />
      {canDelete ? (
        <button
          type="button"
          onClick={onDelete}
          className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded text-white/30 opacity-0 transition-all duration-150 hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
          aria-label="Remove point"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function SectionCard({
  section,
  index,
  isCounterargument,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onDelete,
  onEditStart,
  onEditEnd,
  canMoveUp,
  canMoveDown,
  canDelete,
}: SectionCardProps) {
  const displayTitle = stripNumberPrefix(section.title);

  return (
    <div
      className={`group relative border-b border-white/6 py-4 last:border-b-0 ${
        isCounterargument ? "ml-2 border-l-2 border-l-indigo-400/40 pl-3" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="min-w-[20px] pt-1 text-[13px] tabular-nums text-white/35">
          {isCounterargument ? "↳" : index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <EditableField
            value={displayTitle}
            placeholder="Section title"
            onChange={(title) => onUpdate({ ...section, title: stripNumberPrefix(title) })}
            onEditStart={onEditStart}
            onEditEnd={onEditEnd}
            className="break-words whitespace-pre-wrap text-[15px] font-medium leading-6 text-white/90"
          />

          {isCounterargument ? (
            <p className="mt-2 px-1.5 text-[10px] uppercase tracking-[0.18em] text-indigo-200/75">
              Counterargument
            </p>
          ) : null}

          <div className="mt-3 flex flex-col gap-1 pl-1">
            {section.keyPoints.map((point, pointIndex) => (
              <KeyPointRow
                key={`${section.id}-point-${pointIndex}`}
                value={point}
                onChange={(newValue) => {
                  const updatedPoints = [...section.keyPoints];
                  updatedPoints[pointIndex] = newValue;
                  onUpdate({ ...section, keyPoints: updatedPoints });
                }}
                onDelete={() => {
                  const updatedPoints = section.keyPoints.filter(
                    (_, itemIndex) => itemIndex !== pointIndex
                  );
                  onUpdate({ ...section, keyPoints: updatedPoints });
                }}
                onEditStart={onEditStart}
                onEditEnd={onEditEnd}
                canDelete={section.keyPoints.length > 1}
              />
            ))}

            <button
              type="button"
              onClick={() =>
                onUpdate({
                  ...section,
                  keyPoints: [...section.keyPoints, ""],
                })
              }
              className="mt-2 self-start rounded px-1.5 py-1 text-left text-[13px] text-white/25 transition-colors duration-150 hover:text-indigo-300"
            >
              + Add point
            </button>
          </div>
        </div>

        <div className="flex flex-shrink-0 gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {canMoveUp ? (
            <button
              type="button"
              onClick={onMoveUp}
              className="flex h-6 w-6 items-center justify-center rounded bg-white/[0.06] text-white/50 transition-all duration-150 hover:bg-white/[0.12] hover:text-white/90"
              aria-label="Move section up"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {canMoveDown ? (
            <button
              type="button"
              onClick={onMoveDown}
              className="flex h-6 w-6 items-center justify-center rounded bg-white/[0.06] text-white/50 transition-all duration-150 hover:bg-white/[0.12] hover:text-white/90"
              aria-label="Move section down"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="flex h-6 w-6 items-center justify-center rounded bg-white/[0.06] text-white/50 transition-all duration-150 hover:bg-red-500/15 hover:text-red-300"
              aria-label="Remove section"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function OutlineEditor({
  draft,
  requirements,
  voiceAvailable,
  onUpdate,
  onApprove,
  onEditStart,
  onEditEnd,
}: OutlineEditorProps) {
  const warnings = getOutlineQualityWarnings(draft);
  const approveEnabled = isApproveEnabled(draft);
  const blockingIssues = getBlockingIssues(draft, requirements);

  function updateSection(sectionIndex: number, updatedSection: OutlineDraftSection) {
    onUpdate({
      ...draft,
      sections: draft.sections.map((section, index) =>
        index === sectionIndex ? updatedSection : section
      ),
    });
  }

  function moveSection(sectionIndex: number, direction: "up" | "down") {
    const nextSections = [...draft.sections];
    const swapIndex = direction === "up" ? sectionIndex - 1 : sectionIndex + 1;
    [nextSections[sectionIndex], nextSections[swapIndex]] = [
      nextSections[swapIndex],
      nextSections[sectionIndex],
    ];
    onUpdate({
      ...draft,
      sections: nextSections,
    });
  }

  function deleteSection(sectionIndex: number) {
    onUpdate({
      ...draft,
      sections: draft.sections.filter((_, index) => index !== sectionIndex),
    });
  }

  function addSection() {
    onUpdate({
      ...draft,
      sections: [
        ...draft.sections,
        {
          id: crypto.randomUUID(),
          title: "",
          keyPoints: [""],
          fromGoal: 2,
          victorChecked: false,
        },
      ],
    });
  }

  if (draft.confidence === "building") {
    return (
      <section className="flex h-full items-center justify-center rounded-3xl border border-white/10 bg-slate-950/50 px-8 py-10 backdrop-blur-md">
        <p className="max-w-sm text-center text-sm italic text-white/30">
          Your outline will appear here as Victor builds it.
        </p>
      </section>
    );
  }

  return (
    <section className="h-full overflow-y-auto rounded-3xl border border-white/10 bg-slate-950/50 px-7 py-6 backdrop-blur-md">
      {requirements ? (
        <div className="mb-5">
          <RequirementCoveragePanel draft={draft} requirements={requirements} />
        </div>
      ) : null}

      <div className="space-y-1">
        <div className="py-5">
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
            Your central argument
          </label>
          <EditableField
            value={draft.thesis ?? ""}
            placeholder="Click to add your central argument..."
            onChange={(thesis) => onUpdate({ ...draft, thesis })}
            onEditStart={onEditStart}
            onEditEnd={onEditEnd}
            multiline
            className="min-h-[84px] text-[15px] leading-7 text-white/[0.88]"
          />
        </div>

        <div className="h-px bg-white/6" />

        <div className="py-2">
          {draft.sections.map((section, index) => (
            <SectionCard
              key={section.id}
              section={section}
              index={index}
              isCounterargument={section.fromGoal === 3}
              onUpdate={(updatedSection) => updateSection(index, updatedSection)}
              onMoveUp={() => moveSection(index, "up")}
              onMoveDown={() => moveSection(index, "down")}
              onDelete={() => deleteSection(index)}
              onEditStart={onEditStart}
              onEditEnd={onEditEnd}
              canMoveUp={index > 0}
              canMoveDown={index < draft.sections.length - 1}
              canDelete={draft.sections.length > 2}
            />
          ))}

          <button
            type="button"
            onClick={addSection}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/12 px-4 py-2 text-sm text-white/25 transition-all duration-150 hover:border-indigo-400/40 hover:text-indigo-300"
          >
            <Plus className="h-4 w-4" />
            Add section
          </button>
        </div>

        <div className="h-px bg-white/6" />

        <div className="py-5">
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
            Your conclusion
          </label>
          <EditableField
            value={draft.conclusion ?? ""}
            placeholder="Click to add your conclusion direction..."
            onChange={(conclusion) => onUpdate({ ...draft, conclusion })}
            onEditStart={onEditStart}
            onEditEnd={onEditEnd}
            multiline
            className="min-h-[84px] text-sm leading-7 text-white/75"
          />
        </div>

        <div className="mt-3 border-t border-white/6 pt-6">
          {warnings.length > 0 ? (
            <div className="mb-3">
              {warnings.map((warning, index) => (
                <p key={index} className="py-1 text-[13px] text-amber-300/70">
                  {warning}
                </p>
              ))}
            </div>
          ) : null}
          {blockingIssues.length > 0 ? (
            <div className="mb-3">
              {blockingIssues.map((issue, index) => (
                <p key={`blocking-${index}`} className="py-1 text-[13px] text-rose-300/80">
                  {issue}
                </p>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            disabled={!approveEnabled || blockingIssues.length > 0}
            onClick={() => onApprove(draftToOutlineStructure(draft))}
            className={`w-full rounded-lg px-6 py-3 text-[15px] font-medium transition-all duration-150 ${
              approveEnabled && blockingIssues.length === 0
                ? "bg-indigo-500/90 text-white hover:-translate-y-0.5 hover:bg-indigo-500 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)]"
                : "cursor-not-allowed bg-white/[0.06] text-white/25"
            }`}
          >
            Approve outline -&gt;
          </button>

          {voiceAvailable ? (
            <p className="mt-3 text-center text-xs text-white/30">
              Mirror Mode is active — this paper will sound like you.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
