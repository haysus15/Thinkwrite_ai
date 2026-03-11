import type { QuizQuestionType } from "@/types/academic-studio";

export type MaterialQuizDefaults = {
  questionCount: number;
  difficulty: number;
  questionTypes: QuizQuestionType[];
};

export type MaterialMetadata = {
  tags: string[];
  quizDefaults: MaterialQuizDefaults;
  lastAccessedAt: string | null;
};

export const DEFAULT_QUIZ_DEFAULTS: MaterialQuizDefaults = {
  questionCount: 10,
  difficulty: 3,
  questionTypes: ["multiple_choice", "short_answer"],
};

const ALLOWED_TYPES: QuizQuestionType[] = [
  "multiple_choice",
  "true_false",
  "short_answer",
  "essay",
];

export function normalizeQuizDefaults(
  value: Partial<MaterialQuizDefaults> | null | undefined
): MaterialQuizDefaults {
  const questionCount = Number(value?.questionCount || DEFAULT_QUIZ_DEFAULTS.questionCount);
  const difficulty = Number(value?.difficulty || DEFAULT_QUIZ_DEFAULTS.difficulty);
  const incomingTypes = Array.isArray(value?.questionTypes)
    ? value?.questionTypes
    : DEFAULT_QUIZ_DEFAULTS.questionTypes;
  const questionTypes = incomingTypes.filter((item): item is QuizQuestionType =>
    ALLOWED_TYPES.includes(item as QuizQuestionType)
  );

  return {
    questionCount: Math.max(5, Math.min(50, Number.isFinite(questionCount) ? questionCount : 10)),
    difficulty: Math.max(1, Math.min(5, Number.isFinite(difficulty) ? difficulty : 3)),
    questionTypes: questionTypes.length > 0 ? questionTypes : DEFAULT_QUIZ_DEFAULTS.questionTypes,
  };
}

export function parseMaterialMetadata(sourceId: string | null | undefined): MaterialMetadata {
  if (!sourceId) {
    return {
      tags: [],
      quizDefaults: DEFAULT_QUIZ_DEFAULTS,
      lastAccessedAt: null,
    };
  }

  try {
    const parsed = JSON.parse(sourceId) as {
      tags?: unknown;
      quizDefaults?: Partial<MaterialQuizDefaults>;
      lastAccessedAt?: unknown;
    };

    return {
      tags: Array.isArray(parsed.tags)
        ? parsed.tags
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean)
        : [],
      quizDefaults: normalizeQuizDefaults(parsed.quizDefaults),
      lastAccessedAt:
        typeof parsed.lastAccessedAt === "string" && parsed.lastAccessedAt.trim()
          ? parsed.lastAccessedAt
          : null,
    };
  } catch {
    return {
      tags: [],
      quizDefaults: DEFAULT_QUIZ_DEFAULTS,
      lastAccessedAt: null,
    };
  }
}

export function serializeMaterialMetadata(metadata: MaterialMetadata): string {
  return JSON.stringify({
    tags: metadata.tags,
    quizDefaults: normalizeQuizDefaults(metadata.quizDefaults),
    lastAccessedAt: metadata.lastAccessedAt,
  });
}

export function materialKindLabel(kind: string | null | undefined): string {
  switch (kind) {
    case "lesson_notes":
      return "Lecture notes";
    case "study_guide":
      return "Textbook";
    case "reference":
      return "Article";
    case "uploaded_doc":
      return "Other";
    default:
      return "Other";
  }
}

export function uiTypeToMaterialKind(value: string): string {
  switch (value) {
    case "lecture_notes":
      return "lesson_notes";
    case "textbook":
      return "study_guide";
    case "article":
      return "reference";
    default:
      return "uploaded_doc";
  }
}

export function materialKindToUiType(value: string | null | undefined):
  | "lecture_notes"
  | "textbook"
  | "article"
  | "other" {
  switch (value) {
    case "lesson_notes":
      return "lecture_notes";
    case "study_guide":
      return "textbook";
    case "reference":
      return "article";
    default:
      return "other";
  }
}

export function truncateLabel(input: string, max = 40): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1)}…`;
}
