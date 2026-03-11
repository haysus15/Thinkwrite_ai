import type { Subject } from "@/types/academic-studio";

function countMatches(text: string, keywords: string[]): number {
  return keywords.filter((keyword) => text.includes(keyword)).length;
}

export function detectSubject(message: string): Subject {
  const lower = message.toLowerCase();

  const mathKeywords = [
    "equation",
    "solve",
    "calculate",
    "derivative",
    "integral",
    "algebra",
    "calculus",
    "geometry",
    "statistics",
    "probability",
    "factor",
    "matrix",
    "vector",
    "polynomial",
  ];
  const scienceKeywords = [
    "atom",
    "molecule",
    "cell",
    "evolution",
    "reaction",
    "force",
    "energy",
    "velocity",
    "acceleration",
    "photosynthesis",
    "dna",
    "gene",
    "chemical",
    "physics",
    "biology",
    "chemistry",
  ];
  const writingKeywords = [
    "essay",
    "thesis",
    "paragraph",
    "argument",
    "structure",
    "introduction",
    "conclusion",
    "topic sentence",
    "evidence",
    "literary",
    "narrative",
    "tone",
    "voice",
  ];
  const historyKeywords = [
    "war",
    "revolution",
    "empire",
    "civilization",
    "century",
    "historical",
    "president",
    "government",
    "colony",
    "treaty",
    "constitution",
    "movement",
    "rights",
  ];
  const csKeywords = [
    "algorithm",
    "function",
    "variable",
    "loop",
    "array",
    "object",
    "class",
    "recursion",
    "database",
    "api",
    "code",
    "debug",
    "syntax",
    "compile",
    "runtime",
  ];

  const scores: Record<Subject, number> = {
    math: countMatches(lower, mathKeywords),
    science: countMatches(lower, scienceKeywords),
    writing: countMatches(lower, writingKeywords),
    history: countMatches(lower, historyKeywords),
    "computer-science": countMatches(lower, csKeywords),
    general: 0,
  };

  const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return top && top[1] > 0 ? (top[0] as Subject) : "general";
}

export function shouldUseTeachingMode(message: string): boolean {
  const lower = message.toLowerCase().trim();
  if (!lower) return false;

  if (lower.includes("?")) return true;

  return [
    "help me",
    "how do i",
    "walk me through",
    "explain",
    "solve",
    "break down",
    "step by step",
    "what is",
    "why does",
  ].some((phrase) => lower.includes(phrase));
}
