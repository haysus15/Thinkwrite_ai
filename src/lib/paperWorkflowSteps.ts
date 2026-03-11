export type WorkflowStep = "outline" | "generate" | "checkpoint" | "library";

export interface WorkflowState {
  outlineId: string | null;
  paperId: string | null;
  checkpointPassed: boolean;
  emergencySkipUsed: boolean;
}

export function isStepAccessible(
  step: WorkflowStep,
  state: WorkflowState
): boolean {
  switch (step) {
    case "outline":
      return true;
    case "generate":
      return state.outlineId !== null;
    case "checkpoint":
      return state.paperId !== null;
    case "library":
      return state.checkpointPassed || state.emergencySkipUsed;
    default:
      return false;
  }
}
