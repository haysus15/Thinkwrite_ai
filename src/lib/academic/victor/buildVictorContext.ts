import type { VictorContext } from "./victorTypes";

function toRequirementsSummary(
  requirements: Record<string, unknown> | null
): string {
  if (!requirements) return "not available";

  const entries = Object.entries(requirements)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 12)
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);

  return entries.length > 0 ? entries.join("; ") : "not available";
}

export function buildVictorContext(context: VictorContext): string {
  const section = context.sectionTitle.trim() || "not specified";
  const sectionBody = context.sectionBody?.trim() || "not yet written";
  const assignmentName = context.assignmentName.trim() || "not specified";
  const className = context.className.trim() || "not specified";
  const paperType = context.paperType?.trim() || "not specified";
  const requirements = toRequirementsSummary(context.assignmentRequirements);
  const declarationArgument = context.studentDeclaration?.argument?.trim();
  const declarationPoints = context.studentDeclaration?.main_points?.trim();
  const declarationUnderstanding =
    context.studentDeclaration?.assignment_understanding?.trim();

  const lines = [
    `CURRENT SECTION: ${section}`,
    `SECTION CONTENT: ${sectionBody}`,
    `ASSIGNMENT: ${assignmentName} - ${className}`,
    `REQUIREMENTS: ${requirements}`,
    `PAPER TYPE: ${paperType}`,
  ];

  if (declarationArgument || declarationPoints || declarationUnderstanding) {
    lines.push(
      "STUDENT DECLARATION:",
      `- Argument: ${declarationArgument || "not provided"}`,
      `- Main points: ${declarationPoints || "not provided"}`,
      `- Assignment understanding: ${declarationUnderstanding || "not provided"}`,
      "Ground all responses in these stated positions."
    );
  }

  if (Array.isArray(context.unsureSections) && context.unsureSections.length > 0) {
    lines.push(
      `UNSURE SECTIONS: ${context.unsureSections.join(", ")}`,
      "Give these sections extra instructional attention."
    );
  }

  if (context.knownStruggles && context.knownStruggles.length > 0) {
    lines.push("KNOWN STRUGGLES (from previous sessions):");
    lines.push(
      ...context.knownStruggles.map(
        (item) => `- ${item.concept} (detected ${item.detectedAt})`
      )
    );
    lines.push(
      "Victor should be aware of these but not lead with them. If the conversation touches one of these areas, give it extra attention."
    );
  }

  return lines.join("\n");
}
