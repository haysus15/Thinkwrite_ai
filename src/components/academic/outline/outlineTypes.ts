export interface OutlineStructureSection {
  id: string;
  title: string;
  main_points: string[];
  sources: unknown[];
  evidence: unknown[];
  victor_confirmed: boolean;
  victor_confirmed_at: string | null;
}

export interface OutlineStructure {
  thesis: string;
  conclusion: string;
  sections: OutlineStructureSection[];
  sourceContext?: string[];
}

export interface OutlineDraftSection {
  id: string;
  title: string;
  keyPoints: string[];
  fromGoal: 2 | 3;
  victorChecked: boolean;
}

export interface OutlineDraft {
  thesis: string | null;
  sections: OutlineDraftSection[];
  conclusion: string | null;
  sourceContext?: string[];
  sourcesAcknowledged: boolean;
  requirementGaps: string[];
  confidence: "building" | "draft" | "complete";
}

export interface UnderstandingCheckEntry {
  type: "understanding_check";
  outcome: "confirmed" | "gap" | "misalignment";
  timestamp: string;
  section_id: string;
  victor_response: string;
  student_explanation: string;
}

export interface IntakeConversationEntry {
  type: "intake";
  goal: 1 | 2 | 3 | 4 | 5;
  timestamp: string;
  victor_message: string;
  student_response: string;
}

export type ConversationHistoryEntry =
  | UnderstandingCheckEntry
  | IntakeConversationEntry;

export interface ParsedRequirements {
  assignmentType?: string;
  requiredSections?: string[];
  requiredTopics?: string[];
  minSources?: number;
  citationFormat?: string;
  dueDate?: string;
  wordCount?: string;
  minSections?: number;
}

export interface AssignmentContext {
  assignment_name: string | null;
  class_name: string | null;
  assignment_type: string | null;
  due_date: string | null;
  requirements: ParsedRequirements | null;
  notes: string | null;
  word_count?: number | null;
}

export interface RequirementCoverage {
  label: string;
  covered: boolean;
}

export interface PaperGenerationContext {
  outlineStructure: OutlineStructure;
  conversationHistory: ConversationHistoryEntry[];
  thesis: string;
  requirements: ParsedRequirements | null;
  voiceFingerprint: Record<string, unknown> | null;
}

export interface SectionGenerationStatus {
  sectionId: string;
  sectionTitle: string;
  status: "pending" | "generating" | "complete" | "failed";
  content: string;
  retryCount: number;
}

export interface PaperSource {
  id: string;
  user_id?: string;
  outline_id?: string;
  paper_id?: string | null;
  section_id: string;
  title: string;
  author?: string | null;
  year?: number | null;
  url?: string | null;
  source_type?: "academic" | "news" | "government" | "book" | "other";
  citation_format?: string | null;
  formatted_citation?: string | null;
  victor_evaluation?: string | null;
  victor_approved?: boolean | null;
  created_at?: string;
}

export interface GoalPatternAnalysis {
  averageRoundsToComplete: number;
  typicallyStrong: boolean;
  needsScaffolding: boolean;
}

export interface StudentAcademicProfile {
  papersCompleted: number;
  classesWorkedIn: string[];
  goalPatterns: Record<1 | 2 | 3 | 4 | 5, GoalPatternAnalysis>;
  thesisStrength: "strong" | "needs_support";
  counterargumentStrength: "strong" | "needs_scaffolding";
  conclusionStrength: "strong" | "needs_support";
  lastFivePapers: {
    topic: string;
    className: string | null;
    completedAt: string;
  }[];
  overridePatterns: {
    thesisStrength?: "strong" | "needs_support";
    counterargumentStrength?: "strong" | "needs_scaffolding";
    conclusionStrength?: "strong" | "needs_support";
  };
}

export function draftToOutlineStructure(draft: OutlineDraft): OutlineStructure {
  return {
    thesis: draft.thesis ?? "",
    conclusion: draft.conclusion ?? "",
    sections: draft.sections.map((section) => ({
      id: section.id,
      title: section.title,
      main_points: section.keyPoints,
      sources: [],
      evidence: [],
      victor_confirmed: section.victorChecked,
      victor_confirmed_at: section.victorChecked ? new Date().toISOString() : null,
    })),
    sourceContext: draft.sourceContext ?? [],
  };
}

export function outlineStructureToDraft(structure: OutlineStructure): OutlineDraft {
  return {
    thesis: structure.thesis,
    conclusion: structure.conclusion,
    sections: structure.sections.map((section) => ({
      id: section.id,
      title: section.title,
      keyPoints: section.main_points,
      fromGoal: 2,
      victorChecked: section.victor_confirmed,
    })),
    sourceContext: Array.isArray(structure.sourceContext)
      ? structure.sourceContext.map((item) => String(item))
      : [],
    sourcesAcknowledged: false,
    requirementGaps: [],
    confidence: "complete",
  };
}
