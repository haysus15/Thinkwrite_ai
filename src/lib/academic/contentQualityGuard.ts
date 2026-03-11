export type QuizGuardQuestion = {
  text: string;
  explanation?: string;
  source_snippet?: string;
};

export type StudyGuideContext = {
  language?: string;
  lessonTitle: string;
  conceptSummary?: string;
  challengePrompt?: string;
  requiredSkills?: string[];
  pathTitle?: string;
};

export type PaperRequirements = {
  wordCount?: number;
  minSources?: number;
  requiredSections?: string[];
};

export type GuardrailResult = {
  passed: boolean;
  reason: string;
  score: number;
};

export type PaperGuardrailResult = GuardrailResult & {
  missing: string[];
  wordCount: number;
  citationCount: number;
};

const ARTIFACT_PATTERN =
  /\/BaseFont|\/Font|\/Type|\/Subtype|\/Length|\/Filter|\/ProcSet|CIDInit|CMapName|begincmap|beginbfchar|defineresource|Adobe-Identity-UCS|Identity-H|xref|startxref|trailer|endobj|stream|ascii85decode|flatedecode|reportlab|pdf library|producer|creator/gi;

const GENERIC_FILLER_PATTERN =
  /as an ai|in conclusion|this comprehensive guide|let me know if you want me to|want me to switch|switch to coding review mode|here'?s a breakdown|this will help you succeed|master this in no time/gi;

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function artifactMatchesCount(text: string) {
  return text.match(ARTIFACT_PATTERN)?.length || 0;
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countCitations(text: string) {
  const parenMatches = text.match(/\([^)]*\d{4}[^)]*\)/g) || [];
  const bracketMatches = text.match(/\[\d+\]/g) || [];
  return Math.max(parenMatches.length, bracketMatches.length);
}

function getTokenSet(text: string) {
  return new Set(
    normalizeText(text)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4)
  );
}

function groundedQuestionCount(questions: QuizGuardQuestion[], sourceContent: string) {
  const sourceLower = normalizeText(sourceContent);
  return questions.filter((question) => {
    const snippet = normalizeText(question.source_snippet || "");
    if (!snippet || snippet.length < 12) return false;
    if (!sourceLower.includes(snippet)) return false;

    const combined = normalizeText(`${question.text} ${question.explanation || ""}`);
    const snippetTokens = Array.from(getTokenSet(snippet));
    if (snippetTokens.length === 0) return false;
    const overlap = snippetTokens.filter((token) => combined.includes(token)).length;
    return overlap >= 1;
  }).length;
}

function buildRelevanceTerms(context: StudyGuideContext) {
  const base = [
    context.lessonTitle,
    context.conceptSummary || "",
    context.challengePrompt || "",
    context.pathTitle || "",
    context.language || "",
    ...(context.requiredSkills || []),
  ]
    .join(" ")
    .toLowerCase();

  return Array.from(
    new Set(
      base
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 4)
        .filter((token) => !["lesson", "language", "path", "skills"].includes(token))
    )
  ).slice(0, 20);
}

export function getQualityScore(content: string): number {
  const text = content.trim();
  if (!text) return 0;

  const wordCountValue = countWords(text);
  const lengthScore = Math.min(40, Math.floor(wordCountValue / 15));

  const codeMarkers = (text.match(/`[^`]+`|\b(def|function|select|from|where|class|return|for|while)\b/gi) || []).length;
  const numericMarkers = (text.match(/\b\d+(\.\d+)?\b/g) || []).length;
  const specificityScore = Math.min(35, codeMarkers * 3 + Math.min(10, numericMarkers));

  const uniqueTokens = getTokenSet(text).size;
  const relevanceScore = Math.min(25, Math.floor(uniqueTokens / 6));

  return Math.max(0, Math.min(100, lengthScore + specificityScore + relevanceScore));
}

export function validateQuizOutput(
  questions: QuizGuardQuestion[],
  sourceContent: string
): GuardrailResult {
  if (questions.length < 3) {
    return {
      passed: false,
      reason: "Generated quiz has too few questions.",
      score: 0,
    };
  }

  const artifactCount = questions.reduce((total, question) => {
    const combined = `${question.text} ${question.explanation || ""} ${question.source_snippet || ""}`;
    return total + artifactMatchesCount(combined);
  }, 0);

  if (artifactCount > 0) {
    return {
      passed: false,
      reason: "Generated quiz includes document artifact tokens.",
      score: Math.max(0, 55 - artifactCount * 5),
    };
  }

  const groundedCount = groundedQuestionCount(questions, sourceContent);
  const groundedRatio = groundedCount / Math.max(questions.length, 1);
  if (groundedRatio < 0.6) {
    return {
      passed: false,
      reason: "Generated quiz is not sufficiently grounded in source material.",
      score: Math.floor(groundedRatio * 100),
    };
  }

  const score = Math.max(
    60,
    Math.min(
      100,
      Math.floor(
        groundedRatio * 70 +
          Math.min(20, questions.length * 2) +
          Math.min(
            10,
            questions.filter((q) => (q.explanation || "").trim().length >= 20).length
          )
      )
    )
  );

  return {
    passed: true,
    reason: "Quiz output passed quality checks.",
    score,
  };
}

export function validateStudyGuide(
  content: string,
  context: StudyGuideContext
): GuardrailResult {
  const text = content.trim();
  if (text.length < 500) {
    return {
      passed: false,
      reason: "Study guide is too short.",
      score: getQualityScore(text),
    };
  }

  const fillerCount = (text.match(GENERIC_FILLER_PATTERN) || []).length;
  if (fillerCount > 0) {
    return {
      passed: false,
      reason: "Study guide contains generic filler phrases.",
      score: Math.max(0, getQualityScore(text) - fillerCount * 10),
    };
  }

  const relevanceTerms = buildRelevanceTerms(context);
  const lowerText = text.toLowerCase();
  const relevanceHits = relevanceTerms.filter((term) => lowerText.includes(term)).length;
  const requiredHits = Math.min(6, Math.max(2, Math.floor(relevanceTerms.length * 0.3)));

  if (relevanceHits < requiredHits) {
    return {
      passed: false,
      reason: "Study guide does not appear aligned with the lesson context.",
      score: Math.max(0, getQualityScore(text) - 20),
    };
  }

  const score = Math.min(100, getQualityScore(text) + Math.min(20, relevanceHits * 3));
  return {
    passed: true,
    reason: "Study guide passed quality checks.",
    score,
  };
}

export function validatePaper(
  content: string,
  requirements: PaperRequirements
): PaperGuardrailResult {
  const missing: string[] = [];
  const words = countWords(content);
  const citations = countCitations(content);

  if (requirements.wordCount && words < requirements.wordCount) {
    missing.push(`Minimum word count: ${requirements.wordCount}`);
  }

  if (requirements.minSources && citations < requirements.minSources) {
    missing.push(`Minimum sources: ${requirements.minSources}`);
  }

  if (requirements.requiredSections?.length) {
    const lowerContent = content.toLowerCase();
    for (const section of requirements.requiredSections) {
      if (!lowerContent.includes(section.toLowerCase())) {
        missing.push(`Missing section: ${section}`);
      }
    }
  }

  const score = getQualityScore(content);
  return {
    passed: missing.length === 0,
    reason:
      missing.length === 0
        ? "Paper passed requirement checks."
        : "Paper is missing assignment requirements.",
    score,
    missing,
    wordCount: words,
    citationCount: citations,
  };
}
