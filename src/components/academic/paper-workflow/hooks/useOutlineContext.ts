"use client";

import { useEffect, useMemo, useState } from "react";

export type OutlineStructure = Record<string, unknown>;

type OutlineMeta = {
  topic: string | null;
  className: string | null;
  assignmentType: string | null;
  assignmentId: string | null;
  assignmentName: string | null;
  dueDate: string | null;
  gradingWeight: number | null;
  assignmentRequirements: Record<string, unknown> | null;
  studentDeclaration: {
    argument?: string;
    main_points?: string;
    assignment_understanding?: string;
  } | null;
  sectionConfidence: Record<string, "solid" | "somewhat_clear" | "unsure"> | null;
  sourceRequirements: Record<string, unknown> | null;
};

export function useOutlineContext(outlineId: string | null, assignmentId?: string | null) {
  const outlineReady = Boolean(outlineId);
  const [outlineBody, setOutlineBody] = useState<OutlineStructure | null>(null);
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [outlineMeta, setOutlineMeta] = useState<OutlineMeta | null>(null);

  useEffect(() => {
    if (!outlineId) return;
    let active = true;
    setOutlineLoading(true);
    setOutlineError(null);

    const loadOutline = async () => {
      try {
        const response = await fetch(`/api/academic/outline/${outlineId}`);
        const data = await response.json();
        if (!response.ok || !data?.outline) {
          throw new Error(data?.error || "Could not load your outline. Please go back and try again.");
        }
        if (!active) return;

        const outline = data.outline as {
          outline_structure?: OutlineStructure | null;
          topic?: string | null;
          class_name?: string | null;
          assignment_type?: string | null;
          assignment_id?: string | null;
          student_declaration?: unknown;
          section_confidence?: unknown;
          source_requirements?: unknown;
        };
        let assignmentName: string | null = null;
        let dueDate: string | null = null;
        let gradingWeight: number | null = null;
        let assignmentRequirements: Record<string, unknown> | null = null;

        if (outline.assignment_id) {
          const assignmentResponse = await fetch(
            `/api/travis/assignment/${outline.assignment_id}`
          );
          const assignmentData = await assignmentResponse.json();
          if (assignmentResponse.ok && assignmentData?.assignment) {
            assignmentName =
              typeof assignmentData.assignment.assignment_name === "string"
                ? assignmentData.assignment.assignment_name
                : null;
            dueDate =
              typeof assignmentData.assignment.due_date === "string"
                ? assignmentData.assignment.due_date
                : null;
            gradingWeight =
              typeof assignmentData.assignment.grading_weight === "number"
                ? assignmentData.assignment.grading_weight
                : null;
            assignmentRequirements =
              assignmentData.assignment.requirements &&
              typeof assignmentData.assignment.requirements === "object"
                ? (assignmentData.assignment.requirements as Record<string, unknown>)
                : null;
          }
        }

        setOutlineBody(outline.outline_structure || null);
        setOutlineMeta({
          topic: outline.topic ?? null,
          className: outline.class_name ?? null,
          assignmentType: outline.assignment_type ?? null,
          assignmentId: outline.assignment_id ?? null,
          assignmentName,
          dueDate,
          gradingWeight,
          assignmentRequirements,
          studentDeclaration:
            outline.student_declaration &&
            typeof outline.student_declaration === "object"
              ? (outline.student_declaration as {
                  argument?: string;
                  main_points?: string;
                  assignment_understanding?: string;
                })
              : null,
          sectionConfidence:
            outline.section_confidence &&
            typeof outline.section_confidence === "object"
              ? (outline.section_confidence as Record<
                  string,
                  "solid" | "somewhat_clear" | "unsure"
                >)
              : null,
          sourceRequirements:
            outline.source_requirements &&
            typeof outline.source_requirements === "object"
              ? (outline.source_requirements as Record<string, unknown>)
              : null,
        });
      } catch (err) {
        if (!active) return;
        setOutlineBody(null);
        setOutlineError(
          err instanceof Error
            ? err.message
            : "Could not load your outline. Please go back and try again."
        );
      } finally {
        if (active) {
          setOutlineLoading(false);
        }
      }
    };

    void loadOutline();
    return () => {
      active = false;
    };
  }, [outlineId]);

  const effectiveAssignmentId = useMemo(
    () => assignmentId || outlineMeta?.assignmentId || null,
    [assignmentId, outlineMeta?.assignmentId]
  );

  return {
    outlineReady,
    outlineBody,
    outlineLoading,
    outlineError,
    outlineMeta,
    effectiveAssignmentId,
  };
}
