import type { MathVerificationResult, StepStatus } from "@/types/math-mode";
import { compareEquationSteps } from "@/lib/math-mode/equivalence";

export function coerceVerificationStatus(value: unknown): StepStatus {
  switch (value) {
    case "correct":
    case "equivalent_form":
    case "likely_correct":
    case "incorrect":
    case "needs_recheck":
    case "error":
    case "partial":
      return value;
    default:
      return "incorrect";
  }
}

export function toLegacyErrorType(
  status: StepStatus
): MathVerificationResult["error_type"] {
  if (status === "incorrect" || status === "error") return "procedural";
  if (status === "likely_correct" || status === "partial") return "procedural";
  return undefined;
}

export function createFallbackVerification(input: {
  stepId: string;
  hasLatex: boolean;
}): MathVerificationResult {
  const status: StepStatus = input.hasLatex ? "likely_correct" : "incorrect";
  const transformation = input.hasLatex
    ? "you applied a valid-looking transformation"
    : "no transformation was submitted";
  return {
    step_id: input.stepId,
    is_correct: status === "likely_correct",
    status,
    error_type: input.hasLatex ? "procedural" : "notation",
    transformation_applied: transformation,
    error_location: input.hasLatex ? null : "the current step input is empty",
    correction_hint: input.hasLatex
      ? "Confirm your variable notation matches the original problem."
      : "Enter one transformation before verifying.",
    feedback: input.hasLatex
      ? "Algebra checks out from structure. Confirm your variable notation matches the problem."
      : "No transformation was submitted. Enter one transformation before verifying.",
    victor_guidance: input.hasLatex
      ? "What rule justifies this transformation?"
      : "Write the transformation first, then explain the rule used.",
  };
}

function truncateToTwoSentences(text: string): string {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 2) return text.trim();
  return `${parts[0]} ${parts[1]}`.trim();
}

export function composeVerificationFeedback(input: {
  status: StepStatus;
  transformationApplied?: string | null;
  errorLocation?: string | null;
  correctionHint?: string | null;
  fallbackFeedback?: string;
}): string {
  const transformation = (input.transformationApplied || "").trim();
  const errorLocation = (input.errorLocation || "").trim();
  const correctionHint = (input.correctionHint || "").trim();
  const fallback = (input.fallbackFeedback || "").trim();

  const normalize = (value: string) =>
    truncateToTwoSentences(value.replace(/\s+/g, " ").trim());

  switch (input.status) {
    case "correct":
      if (transformation) return normalize(`Correct — ${transformation}.`);
      return normalize(fallback || "Correct — the transformation is valid.");
    case "equivalent_form":
      if (transformation) {
        return normalize(`Correct — equivalent form. ${transformation}.`);
      }
      return normalize(fallback || "Correct — this is equivalent in a different form.");
    case "likely_correct":
      if (transformation && correctionHint) {
        return normalize(`Algebra checks out — ${transformation}. ${correctionHint}`);
      }
      return normalize(
        fallback ||
          "Algebra checks out — confirm notation and arithmetic once before moving on."
      );
    case "needs_recheck":
      return normalize(
        correctionHint ||
          fallback ||
          "An earlier step changed. This step depends on it and needs to be re-verified."
      );
    case "incorrect":
    case "error":
    case "partial":
      if (errorLocation && correctionHint) {
        return normalize(`${errorLocation}. ${correctionHint}`);
      }
      if (errorLocation) {
        return normalize(errorLocation);
      }
      return normalize(
        fallback ||
          "This transformation is not valid yet. Re-check the operation and try again."
      );
    default:
      return normalize(
        fallback || "Review this transformation and verify the step again."
      );
  }
}

export function reconcileEquationPair(input: {
  previousLatex?: string;
  currentLatex?: string;
  currentStatus: StepStatus;
  feedback: string;
  guidance: string;
  problemType?: string;
}): { status: StepStatus; feedback: string; guidance: string } {
  const { previousLatex, currentLatex, currentStatus } = input;
  if (!previousLatex?.trim() || !currentLatex?.trim()) {
    return {
      status: currentStatus,
      feedback: input.feedback,
      guidance: input.guidance,
    };
  }
  const normalizedType = String(input.problemType || "").toLowerCase();
  const tolerance =
    normalizedType === "calculus" || normalizedType === "statistics"
      ? 1e-3
      : normalizedType === "geometry"
      ? 1e-5
      : 1e-6;
  const eq = compareEquationSteps(previousLatex, currentLatex, { tolerance });
  const looksEquationLike = (value: string) =>
    /[=≈≟]/.test(value) && /[0-9a-zA-Z]/.test(value);
  if (eq.comparable && eq.repeated) {
    return {
      status: "incorrect",
      feedback:
        "This repeats the previous equation without a new transformation.",
      guidance: "Apply one operation to both sides and write the new result.",
    };
  }
  if (eq.comparable && eq.equivalent && currentStatus !== "correct") {
    if (input.problemType === "calculus" && eq.sampleMatches < 3) {
      return {
        status: "likely_correct",
        feedback:
          "This appears correct. Double-check rounding/notation before moving on.",
        guidance:
          "Confirm your derivative/integral notation and decimal precision.",
      };
    }
    return {
      status: "equivalent_form",
      feedback: "Mathematically equivalent step in a different valid form.",
      guidance:
        "Good. State the rule you used, then continue to the next step.",
    };
  }
  if (eq.comparable && currentStatus === "incorrect") {
    return {
      status: "likely_correct",
      feedback:
        "Looks right structurally. Double-check notation and simplification.",
      guidance: input.guidance,
    };
  }
  if (
    !eq.comparable &&
    currentStatus === "incorrect" &&
    looksEquationLike(previousLatex) &&
    looksEquationLike(currentLatex)
  ) {
    return {
      status: "likely_correct",
      feedback:
        "This step appears structurally valid. Recheck notation and arithmetic once before continuing.",
      guidance:
        "State the exact operation you applied to both sides and verify the arithmetic.",
    };
  }
  return { status: currentStatus, feedback: input.feedback, guidance: input.guidance };
}
