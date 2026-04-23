"use client";

import shared from "../shared/academic.module.css";
import AgendaLeftColumn from "./AgendaLeftColumn";
import AgendaRightColumn from "./AgendaRightColumn";
import { useAcademicAgendaShell } from "./hooks/useAcademicAgendaShell";

export default function AcademicAgendaShell() {
  const { leftColumnProps, rightColumnProps } = useAcademicAgendaShell();

  return (
    <div className={`${shared.root} ${shared.page} grid gap-4 lg:grid-cols-5`}>
      <AgendaLeftColumn {...leftColumnProps} />
      <AgendaRightColumn {...rightColumnProps} />
    </div>
  );
}
