import type { VictorContext } from "./victorTypes";

export type VictorContextValidation = {
  isValid: boolean;
  missingFields: string[];
  recoveryMessage: string | null;
  warningMessages: string[];
};

export function validateVictorContext(context: VictorContext): VictorContextValidation {
  const missingFields: string[] = [];
  const warningMessages: string[] = [];

  if (!context.assignmentName.trim() || !context.className.trim()) {
    missingFields.push("assignment_context");
  }

  const hasSection = Boolean(context.sectionTitle.trim());
  const hasRequirements = Boolean(context.assignmentRequirements);

  if (!hasSection && !hasRequirements) {
    missingFields.push("outline_or_requirements");
  }
  if (!hasSection) {
    missingFields.push("outline");
  }
  if (!hasRequirements) {
    missingFields.push("requirements");
    warningMessages.push(
      "Your assignment requirements are not loaded. Victor will give general guidance until requirements are available."
    );
  }
  if (!context.sectionBody?.trim()) {
    warningMessages.push(
      "The student has not yet written this section. Ground your response in assignment requirements and paper type only. Do not invent content the student should write."
    );
  }

  if (missingFields.includes("assignment_context")) {
    return {
      isValid: false,
      missingFields,
      recoveryMessage:
        "Victor needs your assignment details to help you effectively. Make sure your assignment is linked to this paper.",
      warningMessages,
    };
  }

  if (missingFields.includes("outline_or_requirements")) {
    return {
      isValid: false,
      missingFields,
      recoveryMessage:
        "Victor works best when you have started your outline. Add at least one section to get targeted feedback.",
      warningMessages,
    };
  }

  return {
    isValid: true,
    missingFields,
    recoveryMessage: null,
    warningMessages,
  };
}
