import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ConversationHistoryEntry,
  GoalPatternAnalysis,
  IntakeConversationEntry,
  StudentAcademicProfile,
} from "@/components/academic/outline/outlineTypes";

function avg(values: number[]): number {
  if (values.length === 0) return 1;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function buildStudentAcademicProfile(
  userId: string,
  supabase: SupabaseClient
): Promise<StudentAcademicProfile> {
  const [papersResult, outlinesResult] = await Promise.all([
    supabase
      .from("academic_papers")
      .select("topic, assignment_id, created_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("academic_outlines")
      .select("conversation_history, class_name, created_at")
      .eq("user_id", userId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const papers = papersResult.data ?? [];
  const outlines = outlinesResult.data ?? [];
  const goalRoundCounts: Record<1 | 2 | 3 | 4 | 5, number[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  };

  outlines.forEach((outline) => {
    const history = (outline.conversation_history ?? []) as ConversationHistoryEntry[];
    const intakeHistory = history.filter(
      (entry): entry is IntakeConversationEntry => entry.type === "intake"
    );
    const goalExchanges: Partial<Record<1 | 2 | 3 | 4 | 5, number>> = {};

    intakeHistory.forEach((entry) => {
      goalExchanges[entry.goal] = (goalExchanges[entry.goal] ?? 0) + 1;
    });

    (Object.entries(goalExchanges) as Array<[string, number]>).forEach(([goal, count]) => {
      const parsedGoal = Number(goal) as 1 | 2 | 3 | 4 | 5;
      goalRoundCounts[parsedGoal].push(count);
    });
  });

  const goalPatterns = Object.fromEntries(
    ([1, 2, 3, 4, 5] as const).map((goal) => {
      const averageRoundsToComplete = avg(goalRoundCounts[goal]);
      const pattern: GoalPatternAnalysis = {
        averageRoundsToComplete,
        typicallyStrong: averageRoundsToComplete <= 1.5,
        needsScaffolding: averageRoundsToComplete > 2,
      };
      return [goal, pattern];
    })
  ) as Record<1 | 2 | 3 | 4 | 5, GoalPatternAnalysis>;

  const assignmentIds = papers
    .map((paper) => paper.assignment_id)
    .filter((assignmentId): assignmentId is string => typeof assignmentId === "string");

  let classNames: string[] = [];
  if (assignmentIds.length > 0) {
    const { data: assignments } = await supabase
      .from("assignments")
      .select("class_name")
      .in("id", assignmentIds)
      .not("class_name", "is", null);

    classNames = [
      ...new Set(
        (assignments ?? [])
          .map((assignment) => assignment.class_name)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      ),
    ];
  }

  if (classNames.length === 0) {
    classNames = [
      ...new Set(
        outlines
          .map((outline) => outline.class_name)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      ),
    ];
  }

  return {
    papersCompleted: papers.length,
    classesWorkedIn: classNames,
    goalPatterns,
    thesisStrength: goalPatterns[1].typicallyStrong ? "strong" : "needs_support",
    counterargumentStrength: goalPatterns[3].needsScaffolding
      ? "needs_scaffolding"
      : "strong",
    conclusionStrength: goalPatterns[5].typicallyStrong ? "strong" : "needs_support",
    lastFivePapers: papers.slice(0, 5).map((paper) => ({
      topic:
        typeof paper.topic === "string" && paper.topic.trim()
          ? paper.topic
          : "Untitled paper",
      className: null,
      completedAt:
        typeof paper.created_at === "string" ? paper.created_at : new Date().toISOString(),
    })),
    overridePatterns: {},
  };
}

export function buildProfileGuidance(profile: StudentAcademicProfile): string {
  if (profile.papersCompleted === 0) return "";

  const lines: string[] = [
    `This student has completed ${profile.papersCompleted} paper${profile.papersCompleted > 1 ? "s" : ""}.`,
  ];

  if (profile.thesisStrength === "needs_support") {
    lines.push(
      "Goal 1 (thesis): This student typically needs multiple rounds to reach a defensible thesis. Be patient and provide concrete examples using their topic."
    );
  }

  if (profile.counterargumentStrength === "needs_scaffolding") {
    lines.push(
      "Goal 3 (counterargument): This student often struggles to identify counterarguments independently. Offer specific opposing positions for them to evaluate rather than asking open-endedly."
    );
  }

  if (profile.conclusionStrength === "needs_support") {
    lines.push(
      "Goal 5 (conclusion): This student tends to restate the thesis rather than extend it. Guide them toward 'what changes if the reader accepts your argument' framing."
    );
  }

  lines.push("Do not mention this profile to the student. Apply adjustments naturally.");

  return lines.join("\n");
}
