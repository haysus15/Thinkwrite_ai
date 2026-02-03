// src/app/api/victor/message/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { VictorMode } from "@/types/academic-studio";

export const runtime = "nodejs";

function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

function detectModeIntent(message: string): VictorMode | null {
  const text = message.toLowerCase();
  if (
    text.includes("derivative") ||
    text.includes("integral") ||
    text.includes("equation") ||
    text.includes("algebra") ||
    text.includes("geometry") ||
    text.includes("calculus") ||
    text.includes("math")
  ) {
    return "math";
  }
  if (
    text.includes("i have an idea") ||
    text.includes("thinking about") ||
    text.includes("what if")
  ) {
    return "idea_expansion";
  }
  if (
    text.includes("challenge") ||
    text.includes("tear apart") ||
    text.includes("poke holes") ||
    text.includes("what's wrong with")
  ) {
    return "challenge";
  }
  if (
    text.includes("quiz") ||
    text.includes("test prep") ||
    text.includes("study guide") ||
    text.includes("review for test")
  ) {
    return "study";
  }
  return null;
}

function modeLabel(mode: VictorMode) {
  switch (mode) {
    case "idea_expansion":
      return "Idea Expansion";
    case "challenge":
      return "Challenge";
    case "study":
      return "Study";
    case "math":
      return "Math";
    default:
      return "Default";
  }
}

function buildSystemPrompt(
  mode: VictorMode,
  intensity: number,
  workspaceContext?: string
) {
  const contextNote = workspaceContext
    ? `\n\nCurrent student context:\n${workspaceContext}\nUse this to keep the guidance aligned with the active workspace.`
    : "";
  switch (mode) {
    case "math":
      return `You are Victor in Math Mode.

ABSOLUTE RULES:
1. NEVER give direct answers to math problems
2. NEVER solve problems for the student
3. ALWAYS require the student to show their work first
4. Verify EACH step of their work, not just the final answer
5. When they make an error, ask questions to help them find it
6. If they're completely stuck, teach the concept, then ask them to apply it

Be patient with real struggle and firm about showing work.${contextNote}`;
    case "idea_expansion":
      return `You are Victor in Idea Expansion Mode.
Explore the student's idea from multiple angles. Provide supporting and contradicting viewpoints, related concepts, and help them pick a strong direction.
Never write the work for them. Ask questions that deepen their thinking.${contextNote}`;
    case "challenge":
      return `You are Victor in Challenge Mode at intensity level ${intensity}/5.
Play devil's advocate, find weak points, challenge evidence quality, and push for deeper reasoning.
Be rigorous but supportive. Do not be cruel or dismissive.${contextNote}`;
    case "study":
      return `You are Victor in Study Mode.
Help students prepare for tests through quiz prep, concept review, and study strategy.
Focus on understanding, not memorization. Ask questions to verify comprehension.${contextNote}`;
    default:
      return `You are Victor in Default Mode.
Use Socratic questioning to guide understanding. Be rigorous, supportive, and direct.
Never do the work for them.${contextNote}`;
  }
}

function detectWorkShown(message: string): boolean {
  const patterns = [
    /=/,
    /step\s*\d/i,
    /\d+\s*[+\-*/^]\s*\d+/,
    /d\/dx|∫|∑|√|²|³/,
    /therefore|thus|so|gives/i,
  ];
  return patterns.some((pattern) => pattern.test(message));
}

function detectAnswerRequest(message: string): boolean {
  const patterns = [
    /what('s| is) the answer/i,
    /just tell me/i,
    /solve (this|it) for me/i,
    /what do i get/i,
    /can you (just )?solve/i,
  ];
  return patterns.some((pattern) => pattern.test(message));
}

function detectStuck(message: string): boolean {
  return /don't know|no idea|stuck|where to start/i.test(message);
}

async function verifyMathWork(
  anthropic: Anthropic,
  problem: string,
  studentWork: string
) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    system: `You are evaluating a student's math work step-by-step.
Return JSON: {
  "problemType": "derivative|integral|algebra|geometry|other",
  "steps": [
    {
      "stepNumber": 1,
      "studentWork": "what they wrote",
      "isCorrect": true/false,
      "errorType": "arithmetic|conceptual|procedural|notation",
      "feedback": "specific feedback for this step"
    }
  ],
  "finalAnswerCorrect": true/false,
  "conceptsUsed": ["power rule"],
  "suggestedPractice": "A similar problem"
}`,
    messages: [
      {
        role: "user",
        content: `PROBLEM: ${problem}\n\nSTUDENT'S WORK:\n${studentWork}\n\nVerify each step.`,
      },
    ],
  });

  return JSON.parse(response.content?.[0]?.text || "{}");
}

async function generatePracticeProblem(
  anthropic: Anthropic,
  problem: string,
  conceptsUsed: string[]
) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `Generate a similar practice problem to:\n"${problem}"\nConcepts: ${conceptsUsed.join(
          ", "
        )}\nReturn only the problem.`,
      },
    ],
  });
  return response.content?.[0]?.text?.trim() || "";
}

export async function POST(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const message =
    typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json(
      { success: false, error: "Message is required." },
      { status: 400 }
    );
  }

  const requestedMode = (body?.mode as VictorMode) || "default";
  const suggestedMode = detectModeIntent(message);

  const apiKey = getClaudeApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Missing API key. Add CLAUDE_API_KEY to .env.local and restart next dev.",
      },
      { status: 500 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const conversationId = body?.conversationId as string | undefined;
  let conversationData: {
    id: string;
    messages: Array<{ role: "user" | "assistant"; content: string; timestamp: string }>;
  } | null = null;

  if (conversationId) {
    const { data, error: fetchError } = await supabase
      .from("victor_conversations")
      .select("id, messages")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !data) {
      return NextResponse.json(
        { success: false, error: "Conversation not found." },
        { status: 404 }
      );
    }

    conversationData = data as typeof conversationData;
  }

  if (!conversationId) {
    const { data, error: insertError } = await supabase
      .from("victor_conversations")
      .insert({
        user_id: userId,
        mode: requestedMode,
        messages: [],
        saved: false,
        last_message_at: new Date().toISOString(),
      })
      .select("id, messages")
      .single();

    if (insertError || !data) {
      return NextResponse.json(
        { success: false, error: insertError?.message || "Save failed." },
        { status: 500 }
      );
    }
    conversationData = data as typeof conversationData;
  }

  if (!conversationData) {
    return NextResponse.json(
      { success: false, error: "Conversation not initialized." },
      { status: 500 }
    );
  }

  const currentId = conversationData.id;
  const history = (conversationData.messages || []) as Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: string;
  }>;

  if (requestedMode === "math") {
    const anthropic = new Anthropic({ apiKey });
    const workShown = detectWorkShown(message);
    const askingForAnswer = detectAnswerRequest(message);
    const isStuck = detectStuck(message);

    const { data: session } = await supabase
      .from("math_sessions")
      .select("*")
      .eq("conversation_id", currentId)
      .eq("user_id", userId)
      .eq("completed", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let mathSession = session;
    if (!mathSession) {
      const { data: created } = await supabase
        .from("math_sessions")
        .insert({
          user_id: userId,
          conversation_id: currentId,
          problem_text: message,
          student_work: [],
          completed: false,
        })
        .select("*")
        .single();
      mathSession = created;
    }

    let reply = "";

    if (!workShown) {
      if (askingForAnswer) {
        reply =
          "That's not how this works. Show me your attempt, and I'll help you find where you're stuck.";
      } else if (isStuck) {
        reply =
          "Let's break it down. What type of problem is this, and what rule would you start with?";
      } else {
        reply =
          "Show me what you've tried so far. What formula or method would you start with?";
      }
    } else {
      const verification = await verifyMathWork(
        anthropic,
        mathSession.problem_text,
        message
      );
      const firstError = (verification.steps || []).find(
        (step: any) => !step.isCorrect
      );

      if (firstError) {
        reply = `Let's pause at step ${firstError.stepNumber}. ${firstError.feedback || "Check the rule you're applying."} What should that step look like?`;
      } else if (verification.finalAnswerCorrect) {
        const practice = await generatePracticeProblem(
          anthropic,
          mathSession.problem_text,
          verification.conceptsUsed || []
        );
        reply = `Good. Your steps are solid. Want to try a similar problem?\n${practice}`;
      } else {
        reply =
          "Your steps look consistent, but the final answer doesn't match. Re-check the last step and tell me what you find.";
      }

      await supabase
        .from("math_sessions")
        .update({
          student_work: verification.steps || [],
          verification_results: verification,
          problem_type: verification.problemType || null,
          concepts_used: verification.conceptsUsed || null,
          final_answer_correct: verification.finalAnswerCorrect || false,
          completed: Boolean(verification.finalAnswerCorrect),
          completed_at: verification.finalAnswerCorrect
            ? new Date().toISOString()
            : null,
        })
        .eq("id", mathSession.id)
        .eq("user_id", userId);
    }

    const nextHistory = [
      ...history,
      { role: "user" as const, content: message, timestamp: new Date().toISOString() },
      { role: "assistant" as const, content: reply, timestamp: new Date().toISOString() },
    ];

    await supabase
      .from("victor_conversations")
      .update({
        messages: nextHistory,
        last_message_at: new Date().toISOString(),
        mode: requestedMode,
      })
      .eq("id", currentId)
      .eq("user_id", userId);

    return NextResponse.json(
      {
        success: true,
        conversationId: currentId,
        reply,
        suggestedMode: null,
        requiresConfirmation: false,
      },
      { status: 200 }
    );
  }

  const updatedHistory = [
    ...history,
    { role: "user" as const, content: message, timestamp: new Date().toISOString() },
  ];

  if (suggestedMode && suggestedMode !== requestedMode) {
    const reply = `This sounds like we should switch to ${modeLabel(
      suggestedMode
    )} Mode. Want me to switch?`;

    const nextHistory = [
      ...updatedHistory,
      { role: "assistant" as const, content: reply, timestamp: new Date().toISOString() },
    ];

    await supabase
      .from("victor_conversations")
      .update({
        messages: nextHistory,
        last_message_at: new Date().toISOString(),
        mode: requestedMode,
      })
      .eq("id", currentId)
      .eq("user_id", userId);

    return NextResponse.json(
      {
        success: true,
        conversationId: currentId,
        reply,
        suggestedMode,
        requiresConfirmation: true,
      },
      { status: 200 }
    );
  }

  const intensity = typeof body?.intensity === "number" ? body.intensity : 3;
  const workspaceContext =
    typeof body?.workspaceContext === "string"
      ? body.workspaceContext.trim()
      : "";
  const anthropic = new Anthropic({ apiKey });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 800,
    system: buildSystemPrompt(requestedMode, intensity, workspaceContext),
    messages: updatedHistory.map((item) => ({
      role: item.role,
      content: item.content,
    })),
  });

  const reply = response.content?.[0]?.text || "Keep going. Clarify the claim.";
  const finalHistory = [
    ...updatedHistory,
    { role: "assistant" as const, content: reply, timestamp: new Date().toISOString() },
  ];

  await supabase
    .from("victor_conversations")
    .update({
      messages: finalHistory,
      last_message_at: new Date().toISOString(),
      mode: requestedMode,
    })
    .eq("id", currentId)
    .eq("user_id", userId);

  return NextResponse.json(
    {
      success: true,
      conversationId: currentId,
      reply,
      suggestedMode: null,
      requiresConfirmation: false,
    },
    { status: 200 }
  );
}
