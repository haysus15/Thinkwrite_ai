export type VictorContext = {
  sectionTitle: string;
  sectionBody: string | null;
  assignmentRequirements: Record<string, unknown> | null;
  assignmentName: string;
  className: string;
  paperType: string | null;
  studentDeclaration?: {
    argument?: string;
    main_points?: string;
    assignment_understanding?: string;
  } | null;
  unsureSections?: string[] | null;
  knownStruggles?: Array<{
    concept: string;
    detectedAt: string;
  }>;
};

export type MisconceptionLevel = "none" | "partial" | "fundamental";
