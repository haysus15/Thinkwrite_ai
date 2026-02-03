// src/lib/mirror-mode/writingTypes.ts
// Shared writing type constants and helpers

export type WritingType =
  | "professional"
  | "academic"
  | "creative"
  | "personal"
  | "technical";

export type WritingTypeOption = {
  value: WritingType;
  label: string;
  description: string;
};

export const WRITING_TYPE_OPTIONS: WritingTypeOption[] = [
  {
    value: "professional",
    label: "Professional/Business",
    description: "Work emails, reports, LinkedIn posts",
  },
  {
    value: "academic",
    label: "Academic Writing",
    description: "Essays, research papers, thesis work",
  },
  {
    value: "creative",
    label: "Creative Writing",
    description: "Stories, poetry, personal blogs",
  },
  {
    value: "personal",
    label: "Personal/Casual",
    description: "Journals, letters, reflections",
  },
  {
    value: "technical",
    label: "Technical Documentation",
    description: "Technical docs, guides, specifications",
  },
];

const WRITING_TYPE_LABELS: Record<WritingType, string> = {
  professional: "Professional/Business",
  academic: "Academic Writing",
  creative: "Creative Writing",
  personal: "Personal/Casual",
  technical: "Technical Documentation",
};

const WRITING_TYPE_ABBREVS: Record<WritingType, string> = {
  professional: "PRO",
  academic: "ACA",
  creative: "CRE",
  personal: "PER",
  technical: "TEC",
};

export function isWritingType(value: string | null | undefined): value is WritingType {
  return !!value && Object.prototype.hasOwnProperty.call(WRITING_TYPE_LABELS, value);
}

export function getWritingTypeLabel(type: string | null | undefined): string {
  if (!type) return "General";
  return WRITING_TYPE_LABELS[type as WritingType] || "General";
}

export function getWritingTypeAbbrev(type: string | null | undefined): string {
  if (!type) return "GEN";
  return WRITING_TYPE_ABBREVS[type as WritingType] || "GEN";
}
