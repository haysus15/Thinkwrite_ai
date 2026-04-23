export type TravisPlanningStyle = "gentle" | "balanced" | "strict";
export type TravisAgendaHorizon = "today" | "three_days" | "week";
export type TravisOverdueEmphasis = "low" | "medium" | "high";
export type TravisAssignmentPriority = "due_date" | "impact" | "balanced";
export type TravisReminderDensity = "minimal" | "normal" | "frequent";

export interface TravisSettings {
  planning_style: TravisPlanningStyle;
  agenda_horizon: TravisAgendaHorizon;
  overdue_emphasis: TravisOverdueEmphasis;
  assignment_priority: TravisAssignmentPriority;
  reminder_density: TravisReminderDensity;
  subject_weights: Record<string, unknown>;
}

export const DEFAULT_TRAVIS_SETTINGS: TravisSettings = {
  planning_style: "balanced",
  agenda_horizon: "three_days",
  overdue_emphasis: "medium",
  assignment_priority: "balanced",
  reminder_density: "normal",
  subject_weights: {},
};

export function normalizeTravisSettings(
  value: Partial<TravisSettings> | null | undefined
): TravisSettings {
  return {
    planning_style:
      value?.planning_style === "gentle" ||
      value?.planning_style === "balanced" ||
      value?.planning_style === "strict"
        ? value.planning_style
        : DEFAULT_TRAVIS_SETTINGS.planning_style,
    agenda_horizon:
      value?.agenda_horizon === "today" ||
      value?.agenda_horizon === "three_days" ||
      value?.agenda_horizon === "week"
        ? value.agenda_horizon
        : DEFAULT_TRAVIS_SETTINGS.agenda_horizon,
    overdue_emphasis:
      value?.overdue_emphasis === "low" ||
      value?.overdue_emphasis === "medium" ||
      value?.overdue_emphasis === "high"
        ? value.overdue_emphasis
        : DEFAULT_TRAVIS_SETTINGS.overdue_emphasis,
    assignment_priority:
      value?.assignment_priority === "due_date" ||
      value?.assignment_priority === "impact" ||
      value?.assignment_priority === "balanced"
        ? value.assignment_priority
        : DEFAULT_TRAVIS_SETTINGS.assignment_priority,
    reminder_density:
      value?.reminder_density === "minimal" ||
      value?.reminder_density === "normal" ||
      value?.reminder_density === "frequent"
        ? value.reminder_density
        : DEFAULT_TRAVIS_SETTINGS.reminder_density,
    subject_weights:
      value?.subject_weights && typeof value.subject_weights === "object"
        ? value.subject_weights
        : DEFAULT_TRAVIS_SETTINGS.subject_weights,
  };
}

export function getHorizonDays(horizon: TravisAgendaHorizon): number {
  if (horizon === "today") return 0;
  if (horizon === "week") return 7;
  return 3;
}

export function buildTravisBehaviorContext(settings: TravisSettings): string {
  const planningStyle =
    settings.planning_style === "gentle"
      ? "You surface upcoming work without urgency. You do not use pressure language. You acknowledge workload stress and respond with calm."
      : settings.planning_style === "strict"
        ? "You flag deadlines early and prominently. You do not let overdue items disappear from conversation. You use direct, firm language about incomplete work."
        : "You flag approaching deadlines with moderate urgency. You note what is coming without alarm.";

  const reminderDensity =
    settings.reminder_density === "minimal"
      ? "Do not surface agenda reminders unprompted. Answer what is asked. Wait to be asked about assignments."
      : settings.reminder_density === "frequent"
        ? "Proactively surface upcoming and overdue items throughout the session. Do not wait to be asked."
        : "Surface agenda reminders at natural transition points. If the user completes a topic, briefly note what is coming next.";

  const overdueEmphasis =
    settings.overdue_emphasis === "low"
      ? "Mention overdue work once without dwelling on it."
      : settings.overdue_emphasis === "high"
        ? "Lead with overdue items and keep the overdue count visible in agenda summaries."
        : "Flag overdue work clearly and include it in session summaries.";

  return [
    `Planning style: ${settings.planning_style}. ${planningStyle}`,
    `Agenda horizon: ${settings.agenda_horizon}. Focus proactively on items due within the next ${getHorizonDays(settings.agenda_horizon)} day(s).`,
    `Overdue emphasis: ${settings.overdue_emphasis}. ${overdueEmphasis}`,
    `Assignment priority: ${settings.assignment_priority}. Use this ordering when referencing agenda items.`,
    `Reminder density: ${settings.reminder_density}. ${reminderDensity}`,
  ].join("\n");
}
