// src/lib/mirror-mode/writingTypes.ts
// Shared writing type constants and helpers

export type WritingType =
  | "professional"
  | "academic"
  | "creative"
  | "general"
  | "personal"
  | "technical";

export type Chamber =
  | "career"
  | "academic"
  | "creative"
  | "general";

export type WritingTypeOption = {
  value: WritingType;
  label: string;
  description: string;
};

export const WRITING_TYPE_OPTIONS: WritingTypeOption[] = [
  {
    value: "professional",
    label: "Career",
    description: "Resumes, cover letters, professional writing",
  },
  {
    value: "academic",
    label: "Academic",
    description: "Essays, research papers, thesis work",
  },
  {
    value: "creative",
    label: "Creative",
    description: "Stories, poetry, personal blogs",
  },
  {
    value: "general",
    label: "General/Unclassified",
    description: "Everyday writing that doesn’t fit a specific context",
  },
];

const WRITING_TYPE_LABELS: Record<WritingType, string> = {
  professional: "Career",
  academic: "Academic",
  creative: "Creative",
  general: "General/Unclassified",
  personal: "General/Unclassified",
  technical: "General/Unclassified",
};

const WRITING_TYPE_ABBREVS: Record<WritingType, string> = {
  professional: "CAR",
  academic: "ACA",
  creative: "CRE",
  general: "GEN",
  personal: "GEN",
  technical: "GEN",
};

const WRITING_TYPE_TO_CHAMBER: Record<WritingType, Chamber> = {
  professional: "career",
  academic: "academic",
  creative: "creative",
  general: "general",
  personal: "general",
  technical: "general",
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

export function mapWritingTypeToChamber(type: string | null | undefined): Chamber {
  if (!type) return "general";
  return WRITING_TYPE_TO_CHAMBER[type as WritingType] || "general";
}
