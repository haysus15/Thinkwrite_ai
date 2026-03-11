"use client";

import React from "react";
import AcademicErrorState from "../shared/AcademicErrorState";

type PaperWorkflowErrorBoundaryProps = {
  children: React.ReactNode;
};

type PaperWorkflowErrorBoundaryState = {
  hasError: boolean;
};

export default class PaperWorkflowErrorBoundary extends React.Component<
  PaperWorkflowErrorBoundaryProps,
  PaperWorkflowErrorBoundaryState
> {
  state: PaperWorkflowErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PaperWorkflowErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    void error;
  }

  render() {
    if (this.state.hasError) {
      return (
        <AcademicErrorState
          message="Something went wrong in the paper workflow. Your progress has been saved."
          retry={() => window.location.reload()}
          className="!min-h-0 py-4"
        />
      );
    }

    return this.props.children;
  }
}
