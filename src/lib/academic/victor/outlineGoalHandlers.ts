import type { OutlineDraft, ParsedRequirements } from "@/components/academic/outline/outlineTypes";

export type FollowUpReason =
  | "too_vague"
  | "topic_not_argument"
  | "no_counterargument"
  | "missing_requirement"
  | "too_short";

export interface GoalHandlerResult {
  goalSatisfied: boolean;
  extractedValue: string | null;
  followUpRequired: boolean;
  followUpReason?: FollowUpReason;
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function normalizePoint(point: string) {
  return point
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .slice(0, 5)
    .join(" ");
}

function splitCandidatePoints(studentResponse: string) {
  const explicitList = studentResponse
    .split(/\n|;|•| - /)
    .map((item) => item.trim())
    .filter((item) => item.length > 5);

  if (explicitList.length >= 2) return explicitList;

  return studentResponse
    .split(/,(?!\s*\d)|\band\b/i)
    .map((item) => item.trim())
    .filter((item) => item.length > 8);
}

export function getRequirementGaps(
  outlineDraft: OutlineDraft,
  requirements: ParsedRequirements | null
): string[] {
  if (!requirements) return [];

  const gaps: string[] = [];

  if (requirements.minSections && outlineDraft.sections.length < requirements.minSections) {
    gaps.push(
      `Assignment requires at least ${requirements.minSections} sections — you have ${outlineDraft.sections.length}`
    );
  }

  if (requirements.requiredSections?.length) {
    const missingSections = requirements.requiredSections.filter(
      (requiredSection) =>
        !outlineDraft.sections.some((section) =>
          section.title.toLowerCase().includes(requiredSection.toLowerCase())
        )
    );
    if (missingSections.length > 0) {
      gaps.push(`These required sections are missing: ${missingSections.join(", ")}`);
    }
  }

  if (requirements.requiredTopics?.length) {
    const missingTopics = requirements.requiredTopics.filter(
      (topic) =>
        !outlineDraft.sections.some(
          (section) =>
            section.title.toLowerCase().includes(topic.toLowerCase()) ||
            section.keyPoints.some((point) => point.toLowerCase().includes(topic.toLowerCase()))
        )
    );
    if (missingTopics.length > 0) {
      gaps.push(`These required topics are not yet covered: ${missingTopics.join(", ")}`);
    }
  }

  if (requirements.minSources && !outlineDraft.sourcesAcknowledged) {
    gaps.push(
      `This assignment requires ${requirements.minSources} sources in ${requirements.citationFormat ?? "the required"} format`
    );
  }

  return gaps;
}

export function evaluateThesisResponse(studentResponse: string): GoalHandlerResult {
  const response = studentResponse.trim();
  const lower = response.toLowerCase();

  if (wordCount(response) < 8) {
    return {
      goalSatisfied: false,
      extractedValue: null,
      followUpRequired: true,
      followUpReason: "too_short",
    };
  }

  if (lower.includes("?")) {
    return {
      goalSatisfied: false,
      extractedValue: null,
      followUpRequired: true,
      followUpReason: "topic_not_argument",
    };
  }

  const topicPhrases = [
    "my paper is about",
    "this paper is about",
    "is about",
    "focuses on",
    "discusses",
    "explores",
    "examines",
    "is important",
    "is interesting",
  ];
  if (topicPhrases.some((phrase) => lower.includes(phrase))) {
    return {
      goalSatisfied: false,
      extractedValue: null,
      followUpRequired: true,
      followUpReason: "topic_not_argument",
    };
  }

  const positionIndicators = [
    "argue",
    "claim",
    "contend",
    "assert",
    "should",
    "must",
    "because",
    "shows that",
    "demonstrates that",
    "leads to",
    "results in",
    "is responsible for",
    "fails to",
    "needs to",
    "proves",
  ];

  if (!positionIndicators.some((indicator) => lower.includes(indicator))) {
    return {
      goalSatisfied: false,
      extractedValue: null,
      followUpRequired: true,
      followUpReason: "topic_not_argument",
    };
  }

  return {
    goalSatisfied: true,
    extractedValue: response,
    followUpRequired: false,
  };
}

export function evaluateSupportingPointsResponse(
  studentResponse: string
): GoalHandlerResult {
  const response = studentResponse.trim();
  const points = splitCandidatePoints(response);

  if (points.length < 2) {
    return {
      goalSatisfied: false,
      extractedValue: null,
      followUpRequired: true,
      followUpReason: "too_vague",
    };
  }

  const distinctRoots = new Set(points.map(normalizePoint).filter(Boolean));
  if (distinctRoots.size < 2) {
    return {
      goalSatisfied: false,
      extractedValue: null,
      followUpRequired: true,
      followUpReason: "too_vague",
    };
  }

  return {
    goalSatisfied: true,
    extractedValue: points.join("\n"),
    followUpRequired: false,
  };
}

export function evaluateCounterargumentResponse(studentResponse: string): GoalHandlerResult {
  const response = studentResponse.trim();
  const lower = response.toLowerCase();

  const cantThinkPhrases = [
    "i don't know",
    "i dont know",
    "i can't",
    "i cant",
    "not sure",
    "no counterargument",
    "there isn't",
  ];

  if (wordCount(response) < 5 || cantThinkPhrases.some((phrase) => lower.includes(phrase))) {
    return {
      goalSatisfied: false,
      extractedValue: null,
      followUpRequired: true,
      followUpReason: "no_counterargument",
    };
  }

  return {
    goalSatisfied: true,
    extractedValue: response,
    followUpRequired: false,
  };
}

export function evaluateRequirementCoverage(
  currentDraft: OutlineDraft,
  requirements: ParsedRequirements | null
): GoalHandlerResult {
  if (!requirements) {
    return {
      goalSatisfied: true,
      extractedValue: null,
      followUpRequired: false,
    };
  }

  const gaps = getRequirementGaps(currentDraft, requirements);
  if (gaps.length > 0) {
    return {
      goalSatisfied: false,
      extractedValue: gaps[0],
      followUpRequired: true,
      followUpReason: "missing_requirement",
    };
  }

  return {
    goalSatisfied: true,
    extractedValue: null,
    followUpRequired: false,
  };
}

export function evaluateConclusionResponse(studentResponse: string): GoalHandlerResult {
  const response = studentResponse.trim();

  if (wordCount(response) < 8) {
    return {
      goalSatisfied: false,
      extractedValue: null,
      followUpRequired: true,
      followUpReason: "too_short",
    };
  }

  return {
    goalSatisfied: true,
    extractedValue: response,
    followUpRequired: false,
  };
}
