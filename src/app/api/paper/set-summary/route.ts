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
      return block.type === "text" && typeof block.text === "string" ? block.text : "";
    })
    .join("\n")
    .trim();
}

export async function POST(request: Request) {
  const { userId } = await getAuthUser();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const assignmentSetId =
      typeof body?.assignment_set_id === "string" ? body.assignment_set_id : "";
    if (!assignmentSetId) {
      return NextResponse.json({ error: "assignment_set_id is required." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const [{ data: setRow, error: setError }, { data: papers, error: papersError }] = await Promise.all([
      supabase
        .from("paper_assignment_sets")
        .select("id, title, class_name, created_at, completed_at")
        .eq("id", assignmentSetId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("academic_papers")
        .select("id, topic, paper_content, word_count, is_complete, created_at, updated_at, completed_at, set_order")
        .eq("user_id", userId)
        .eq("assignment_set_id", assignmentSetId)
        .order("set_order", { ascending: true }),
    ]);

    if (setError || !setRow) {
      return NextResponse.json({ error: setError?.message || "Set not found." }, { status: 404 });
    }
    if (papersError || !Array.isArray(papers)) {
      return NextResponse.json({ error: papersError?.message || "Unable to load papers." }, { status: 500 });
    }

    const papersTotal = papers.length;
    const totalWords = papers.reduce((sum, paper) => {
      const byColumn = Number(paper.word_count || 0);
      if (byColumn > 0) return sum + byColumn;
      return sum + String(paper.paper_content || "").trim().split(/\s+/).filter(Boolean).length;
    }, 0);

    const revisedPapers = papers.filter((paper) => {
      if (!paper.completed_at || !paper.updated_at) return false;
      const completedAt = new Date(String(paper.completed_at)).getTime();
      const updatedAt = new Date(String(paper.updated_at)).getTime();
      return Number.isFinite(completedAt) && Number.isFinite(updatedAt) && updatedAt > completedAt;
    }).length;

    const cleanCompletions = papers.filter((paper) => Boolean(paper.is_complete)).length - revisedPapers;

    const startTs = new Date(String(setRow.created_at)).getTime();
    const endTs = setRow.completed_at
      ? new Date(String(setRow.completed_at)).getTime()
      : Date.now();
    const timeToCompleteSeconds =
      Number.isFinite(startTs) && Number.isFinite(endTs) && endTs > startTs
        ? Math.round((endTs - startTs) / 1000)
        : 0;

    let naturalSummary = "You completed the full writing assignment set.";
    const apiKey = getClaudeApiKey();
    if (apiKey) {
      try {
        const promptTypes = papers.map((paper) => {
          const text = String(paper.topic || "").toLowerCase();
          if (text.includes("reflect")) return "reflection";
          if (text.includes("analy")) return "analysis";
          if (text.includes("essay")) return "essay";
          return "other";
        });

        const anthropic = new Anthropic({ apiKey });
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 260,
          system: "Write specific, factual summaries. No generic praise.",
          messages: [
            {
              role: "user",
              content: `A student completed a writing assignment set with ${papersTotal} papers.
Assignment: ${setRow.title}
Class: ${setRow.class_name || "Not specified"}
Prompt types: ${promptTypes.join(", ") || "other"}
Total words: ${totalWords}
Papers requiring revision: ${Math.max(revisedPapers, 0)}

Write two to three sentences summarizing their performance across the full assignment.
Reference the types of writing they completed and any notable patterns.
Do not use generic praise. Be specific and factual.`,
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
      papers_total: papersTotal,
      clean_completions: Math.max(cleanCompletions, 0),
      revised_papers: Math.max(revisedPapers, 0),
      total_words: totalWords,
      time_to_complete_seconds: timeToCompleteSeconds,
      natural_summary: naturalSummary,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to build set summary." },
      { status: 500 }
    );
  }
}
