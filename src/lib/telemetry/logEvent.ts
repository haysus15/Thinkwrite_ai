import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TelemetryEventType =
  | "quiz_generation_failed"
  | "quiz_generation_low_quality"
  | "study_guide_below_threshold"
  | "study_guide_retry_succeeded"
  | "study_guide_retry_failed"
  | "assignment_parse_error"
  | "assignment_parse_low_confidence"
  | "user_drop_off"
  | "paper_generation_failed"
  | "paper_requirements_failed";

export type TelemetrySeverity = "info" | "warn" | "error";

export async function logEvent(input: {
  userId: string;
  eventType: TelemetryEventType;
  workspace?: string | null;
  severity?: TelemetrySeverity;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.from("telemetry_events").insert({
      user_id: input.userId,
      event_type: input.eventType,
      workspace: input.workspace ?? null,
      severity: input.severity ?? "info",
      payload: input.payload ?? {},
    });
  } catch {
    // Telemetry must never block or break caller behavior.
  }
}
