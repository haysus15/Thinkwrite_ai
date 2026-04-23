import { lazy } from "react";

export const STUDIO_COMPONENTS = {
  paper: lazy(() =>
    import("./wrappers/PaperWorkflowWrapper").then((module) => ({
      default: module.PaperWorkflowWrapper,
    }))
  ),
  math: lazy(() =>
    import("./wrappers/MathModeWrapper").then((module) => ({
      default: module.MathModeWrapper,
    }))
  ),
  study: lazy(() =>
    import("./wrappers/StudyHubWrapper").then((module) => ({
      default: module.StudyHubWrapper,
    }))
  ),
  agenda: lazy(() =>
    import("./wrappers/AgendaWrapper").then((module) => ({
      default: module.AgendaWrapper,
    }))
  ),
  code_review: lazy(() =>
    import("./wrappers/CodeReviewWrapper").then((module) => ({
      default: module.CodeReviewWrapper,
    }))
  ),
} as const;

export type StudioKey = keyof typeof STUDIO_COMPONENTS;
