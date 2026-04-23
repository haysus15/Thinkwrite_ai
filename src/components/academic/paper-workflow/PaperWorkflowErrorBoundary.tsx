"use client";

import React from "react";
import { useTranslations } from "next-intl";
import AcademicErrorState from "../shared/AcademicErrorState";

type PaperWorkflowErrorBoundaryProps = {
  children: React.ReactNode;
  message?: string;
};

type PaperWorkflowErrorBoundaryState = {
  hasError: boolean;
};

class PaperWorkflowErrorBoundaryInner extends React.Component<
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
          message={this.props.message || ""}
          retry={() => window.location.reload()}
          className="!min-h-0 py-4"
        />
      );
    }

    return this.props.children;
  }
}

export default function PaperWorkflowErrorBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("academic.paperWorkflow.errorBoundary");

  return (
    <PaperWorkflowErrorBoundaryInner message={t("message")}>
      {children}
    </PaperWorkflowErrorBoundaryInner>
  );
}
