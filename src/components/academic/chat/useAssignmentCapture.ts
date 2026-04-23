"use client";

import { useCallback } from "react";
import type { AssignmentRow } from "@/types/academic";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeAssignmentType } from "@/lib/academic/assignmentType";
import type {
  AcademicChatExtractedData,
  AcademicIntentResult,
} from "./chatTypes";

type AssignmentCorrectionInput = {
  assignmentId: string;
  current: AssignmentRow;
  updates: Partial<
    Pick<
      AssignmentRow,
      "assignment_name" | "class_name" | "assignment_type" | "due_date"
    >
  >;
  reason?: string | null;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

function buildAssignmentUpdates(
  extractedData: AcademicChatExtractedData,
  originalMessage: string
) {
  const requirements = extractedData.requirements
    ? {
        min_sources: extractedData.requirements.minSources,
        citation_style: extractedData.requirements.citationFormat,
        page_count: extractedData.requirements.pageCount,
        word_count: extractedData.requirements.wordCount,
        min_sections: extractedData.requirements.minSections,
        required_sections: extractedData.requirements.requiredSections,
      }
    : null;

  return {
    assignment_name:
      extractedData.assignmentName?.trim() ||
      extractedData.topic?.trim() ||
      "Untitled Assignment",
    class_name: extractedData.className?.trim() || "General",
    assignment_type: normalizeAssignmentType(
      extractedData.assignmentType?.trim(),
      extractedData.assignmentName?.trim() || extractedData.topic?.trim() || "Untitled Assignment"
    ),
    due_date: extractedData.dueDate?.trim() || null,
    status: "in_progress" as const,
    requirements,
    notes: `Created from chat: "${originalMessage}"`,
    updated_at: new Date().toISOString(),
  };
}

function getChangedFields(
  current: AssignmentRow,
  updates: AssignmentCorrectionInput["updates"]
) {
  const nextEntries = Object.entries(updates).filter(([, value]) => value !== undefined);

  return nextEntries
    .filter(([field, value]) => {
      const currentValue = current[field as keyof AssignmentRow];
      return JSON.stringify(currentValue ?? null) !== JSON.stringify(value ?? null);
    })
    .map(([field, value]) => ({
      field,
      oldValue: JSON.stringify(
        current[field as keyof AssignmentRow] ?? null
      ),
      newValue: JSON.stringify(value ?? null),
    }));
}

export function useAssignmentCapture(userId: string | null | undefined) {
  const captureAssignmentFromIntent = useCallback(
    async (intent: AcademicIntentResult, originalMessage: string) => {
      if (!userId) return null;

      const { extractedData } = intent;
      if (!extractedData.topic && !extractedData.assignmentName) return null;

      const supabase = createSupabaseBrowserClient();

      const { data: existingAssignments, error: lookupError } = await supabase
        .from("assignments")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["inbox", "planned", "in_progress", "ready_to_submit"]);

      if (lookupError) {
        throw new Error(lookupError.message || "Could not check existing assignments.");
      }

      const existing =
        existingAssignments?.find((assignment) => {
          const byName =
            normalizeText(assignment.assignment_name) ===
            normalizeText(extractedData.assignmentName);
          const byTopic =
            normalizeText(assignment.assignment_name) ===
            normalizeText(extractedData.topic);
          const byClass =
            !extractedData.className ||
            normalizeText(assignment.class_name) ===
              normalizeText(extractedData.className);

          return byClass && (byName || byTopic);
        }) || null;

      if (existing) {
        const { error: updateError } = await supabase
          .from("assignments")
          .update({
            status: "in_progress",
            requirements:
              buildAssignmentUpdates(extractedData, originalMessage).requirements ??
              existing.requirements ??
              null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .eq("user_id", userId);

        if (updateError) {
          throw new Error(updateError.message || "Could not update assignment.");
        }

        return existing.id;
      }

      const payload = buildAssignmentUpdates(extractedData, originalMessage);
      const { data, error } = await supabase
        .from("assignments")
        .insert({
          user_id: userId,
          ...payload,
        })
        .select("id")
        .single();

      if (error) {
        throw new Error(error.message || "Could not create assignment.");
      }

      return data?.id ?? null;
    },
    [userId]
  );

  const applyAssignmentCorrection = useCallback(
    async ({ assignmentId, current, updates, reason }: AssignmentCorrectionInput) => {
      if (!userId) return null;

      const supabase = createSupabaseBrowserClient();
      const changedFields = getChangedFields(current, updates);

      if (changedFields.length > 0) {
        const { error: overrideError } = await supabase
          .from("assignment_overrides")
          .insert(
            changedFields.map((change) => ({
              assignment_id: assignmentId,
              user_id: userId,
              field_changed: change.field,
              old_value: change.oldValue,
              new_value: change.newValue,
              reason: reason || "Corrected in academic chat",
            }))
          );

        if (overrideError) {
          throw new Error(overrideError.message || "Could not record assignment override.");
        }
      }

      const { error: updateError } = await supabase
        .from("assignments")
        .update({
          ...updates,
          assignment_type:
            updates.assignment_type === undefined
              ? undefined
              : normalizeAssignmentType(
                  updates.assignment_type,
                  updates.assignment_name ?? current.assignment_name
                ),
          updated_at: new Date().toISOString(),
        })
        .eq("id", assignmentId)
        .eq("user_id", userId);

      if (updateError) {
        throw new Error(updateError.message || "Could not update assignment.");
      }

      return assignmentId;
    },
    [userId]
  );

  return {
    captureAssignmentFromIntent,
    applyAssignmentCorrection,
  };
}
