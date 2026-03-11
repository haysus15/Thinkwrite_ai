import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

function readFirstText(content: unknown): string {
  if (!Array.isArray(content) || content.length === 0) return "";
  return content
    .map((entry) => {
      if (!entry || typeof entry !== "object" || !("type" in entry)) return "";
      const block = entry as { type?: string; text?: unknown };
      return block.type === "text" && typeof block.text === "string"
        ? block.text
        : "";
    })
    .join("\n")
    .trim();
}

export async function POST(request: Request) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const problemSetId =
      typeof body?.problem_set_id === "string" ? body.problem_set_id : "";
    if (!problemSetId) {
      return NextResponse.json(
        { error: "problem_set_id is required." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const [problemsResult, sessionsResult, stepsResult, conceptResult] =
      await Promise.all([
        supabase
          .from("math_problems")
          .select("id, latex, problem_type, completed, set_order")
          .eq("problem_set_id", problemSetId)
          .eq("user_id", userId)
          .order("set_order", { ascending: true }),
        supabase
          .from("math_work_sessions")
          .select("problem_id, hints_used, started_at, completed_at")
          .eq("user_id", userId)
          .order("started_at", { ascending: false }),
        supabase
          .from("math_steps")
          .select("problem_id, status")
          .eq("user_id", userId),
        supabase
          .from("math_concept_progress")
          .select("concept, mastery_level, times_encountered")
          .eq("user_id", userId)
          .order("times_encountered", { ascending: false })
          .limit(8),
      ]);

    if (problemsResult.error || !Array.isArray(problemsResult.data)) {
      return NextResponse.json(
        { error: problemsResult.error?.message || "Unable to load set problems." },
        { status: 500 }
      );
    }
    if (sessionsResult.error || stepsResult.error || conceptResult.error) {
      return NextResponse.json(
        {
          error:
            sessionsResult.error?.message ||
            stepsResult.error?.message ||
            conceptResult.error?.message ||
            "Unable to compute set summary.",
        },
        { status: 500 }
      );
    }

    const problems = problemsResult.data;
    const problemIds = new Set(problems.map((problem) => String(problem.id)));
    const setSessions = (sessionsResult.data || []).filter((session) =>
      problemIds.has(String(session.problem_id))
    );
    const setSteps = (stepsResult.data || []).filter((step) =>
      problemIds.has(String(step.problem_id))
    );

    const problemRevisionMap = new Map<string, number>();
    for (const step of setSteps) {
      const isRevisionStatus = ["incorrect", "error", "partial"].includes(
        String(step.status || "")
      );
      if (!isRevisionStatus) continue;
      const key = String(step.problem_id);
      problemRevisionMap.set(key, (problemRevisionMap.get(key) || 0) + 1);
    }

    const cleanSolves = problems.filter(
      (problem) => (problemRevisionMap.get(String(problem.id)) || 0) === 0
    ).length;
    const revisedProblems = problems.length - cleanSolves;
    const hintsUsed = setSessions.reduce(
      (sum, row) => sum + Number(row.hints_used || 0),
      0
    );
    const totalTimeSeconds = setSessions.reduce((sum, row) => {
      const start = row.started_at ? new Date(String(row.started_at)).getTime() : 0;
      const end = row.completed_at ? new Date(String(row.completed_at)).getTime() : 0;
      if (!start || !end || end <= start) return sum;
      return sum + Math.round((end - start) / 1000);
    }, 0);

    const hardestProblem = problems
      .map((problem) => ({
        id: String(problem.id),
        set_order: Number(problem.set_order || 0),
        latex: String(problem.latex || ""),
        revisions: problemRevisionMap.get(String(problem.id)) || 0,
      }))
      .sort((a, b) => b.revisions - a.revisions)[0] || null;

    const concepts = Array.isArray(conceptResult.data)
      ? conceptResult.data.map((concept) => ({
          tag: String(concept.concept || "general"),
          display_name: String(concept.concept || "general")
            .replace(/[_-]+/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase()),
          mastery_level: Math.max(
            0,
            Math.min(100, Number(concept.mastery_level || 0))
          ),
        }))
      : [];

    let naturalSummary = "You completed the worksheet and closed each problem loop.";
    const apiKey = getClaudeApiKey();
    if (apiKey) {
      try {
        const anthropic = new Anthropic({ apiKey });
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 260,
          system:
            "Write specific, factual learning summaries. Avoid generic praise.",
          messages: [
            {
              role: "user",
              content: `A student completed a math assignment with ${problems.length} problems.
Problems: ${problems.map((problem) => String(problem.problem_type || "other")).join(", ")}
Clean solves: ${cleanSolves}
Required revision: ${revisedProblems}
Concepts covered: ${concepts.map((concept) => concept.display_name).join(", ") || "General"}
Total time: ${Math.round(totalTimeSeconds / 60)} minutes

Write two to three sentences summarizing their performance across the full assignment.
Be specific about which concepts they handled well and where the pattern of difficulty was.
Do not use generic praise. Reference the actual concepts and problem types.`,
            },
          ],
        });
        const generated = readFirstText(response.content);
        if (generated) naturalSummary = generated;
      } catch {
        // keep fallback
      }
    }

    return NextResponse.json({
      steps_total: setSteps.length,
      clean_solves: cleanSolves,
      revised_problems: revisedProblems,
      hints_used: hintsUsed,
      total_time_seconds: totalTimeSeconds,
      concepts,
      hardest_problem: hardestProblem,
      natural_summary: naturalSummary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to build set summary.",
      },
      { status: 500 }
    );
  }
}
