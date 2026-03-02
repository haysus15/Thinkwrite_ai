import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";

export const runtime = "nodejs";

type CodingLanguage = "python" | "sql" | "javascript";

function languageLabel(language: CodingLanguage) {
  if (language === "python") return "Python";
  if (language === "sql") return "SQL";
  return "JavaScript";
}

function buildFallbackGuide(input: {
  language: CodingLanguage;
  lessonTitle: string;
  conceptSummary: string;
  challengePrompt: string;
  requiredSkills: string[];
  pathTitle?: string;
  lessonIndex?: number;
}) {
  const label = languageLabel(input.language);
  const skills =
    input.requiredSkills.length > 0
      ? input.requiredSkills.join(", ")
      : "variables, control flow, functions";
  const lessonNumber =
    typeof input.lessonIndex === "number" ? input.lessonIndex + 1 : null;
  const lessonLine = lessonNumber
    ? `Lesson ${lessonNumber}: ${input.lessonTitle}`
    : input.lessonTitle;
  const pathLine = input.pathTitle ? `Path: ${input.pathTitle}` : "Path: General";

  const syntaxExamples =
    input.language === "python"
      ? [
          "Variables: `name = \"Ada\"`",
          "Conditionals: `if score >= 70: print(\"Pass\")`",
          "Loops: `for item in items:`",
          "Functions: `def total(values): return sum(values)`",
        ]
      : input.language === "sql"
      ? [
          "Select columns: `SELECT id, name FROM students;`",
          "Filter rows: `WHERE score >= 70`",
          "Aggregate: `SELECT class_id, COUNT(*) FROM enrollments GROUP BY class_id;`",
          "Join tables: `FROM orders o JOIN customers c ON c.id = o.customer_id`",
        ]
      : [
          "Variables: `const name = \"Ada\";`",
          "Conditionals: `if (score >= 70) { ... }`",
          "Loops: `for (const item of items) { ... }`",
          "Functions: `function total(values) { return values.reduce((a,b)=>a+b,0); }`",
        ];

  return `# ${label} Study Guide: ${lessonLine}
${pathLine}

## Lesson Focus
${input.conceptSummary || "Build practical understanding of this lesson's core concept."}

## Why It Matters
This lesson helps you write reliable ${label} solutions and reason about code behavior during assignments and exams.

## Core Concepts
- ${input.lessonTitle}
- ${input.challengePrompt || "Apply the concept in a small real-world task."}
- Required skills: ${skills}
- Inputs, outputs, and expected behavior
- Debugging and validation checks

## Syntax Patterns (${label})
${syntaxExamples.map((line) => `- ${line}`).join("\n")}

## Step-by-Step Method
1. Restate the task in plain language.
2. Identify inputs and expected output.
3. Choose a control-flow strategy.
4. Write a minimal working version first.
5. Test with normal and edge cases.
6. Refactor for clarity.

## Common Mistakes and Fixes
- Mistake: jumping into code without a plan.
Fix: write pseudocode first.
- Mistake: ignoring edge cases.
Fix: test empty, null, and boundary inputs.
- Mistake: syntax-level confusion.
Fix: compare against the syntax patterns above.

## Practice Problems
1. Create a basic solution for: ${input.challengePrompt || input.lessonTitle}.
2. Rewrite the same solution using cleaner variable names and comments.
3. Add validation for bad input.
4. Optimize one part of your solution for readability.
5. Explain your final solution in 4-6 sentences.

## Answer Key (Concise)
1. A valid solution should satisfy the prompt and pass at least 3 test cases.
2. Refactor with clear names and one responsibility per block.
3. Validate types/ranges before main logic.
4. Prefer simple control flow over clever shortcuts.
5. A strong explanation covers inputs, process, and output.

## Quick Self-Check Quiz
1. What is the primary objective of this lesson?  
Answer: Apply ${input.lessonTitle} to produce correct outputs.
2. Why should you test edge cases?  
Answer: To catch failures before submission.
3. What should come before coding?  
Answer: A short plan or pseudocode.
4. How do you improve readability?  
Answer: Clear naming, small steps, and comments where needed.
5. What makes a solution complete?  
Answer: Correctness, clarity, and tested behavior.`;
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
  const language = (body?.language || "python") as CodingLanguage;
  const lessonTitle =
    typeof body?.lessonTitle === "string" ? body.lessonTitle.trim() : "";
  const conceptSummary =
    typeof body?.conceptSummary === "string" ? body.conceptSummary.trim() : "";
  const challengePrompt =
    typeof body?.challengePrompt === "string" ? body.challengePrompt.trim() : "";
  const requiredSkills = Array.isArray(body?.requiredSkills)
    ? body.requiredSkills
        .map((value: unknown) => String(value || "").trim())
        .filter(Boolean)
    : [];
  const pathTitle =
    typeof body?.pathTitle === "string" ? body.pathTitle.trim() : "";
  const lessonIndex =
    typeof body?.lessonIndex === "number" ? body.lessonIndex : undefined;
  const struggleTopics = Array.isArray(body?.struggleTopics)
    ? body.struggleTopics
        .map((value: unknown) => String(value || "").trim())
        .filter(Boolean)
    : [];

  if (!lessonTitle) {
    return NextResponse.json(
      { success: false, error: "Lesson title is required." },
      { status: 400 }
    );
  }

  const fallback = buildFallbackGuide({
    language,
    lessonTitle,
    conceptSummary,
    challengePrompt,
    requiredSkills,
    pathTitle,
    lessonIndex,
  });

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: true, guide: fallback, source: "fallback" },
      { status: 200 }
    );
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const label = languageLabel(language);
    const lessonNumber =
      typeof lessonIndex === "number" ? lessonIndex + 1 : "N/A";
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1800,
      temperature: 0.2,
      system: `You are an expert ${label} instructor creating lesson-accurate study guides.
Return only study-guide content in Markdown.
Never mention mode switching, tools, chat controls, or "Want me to switch".
Keep content specific to the provided lesson and language.`,
      messages: [
        {
          role: "user",
          content: `Create a high-quality ${label} study guide for one coding lesson.

Required exact sections:
1) Lesson Focus
2) Why It Matters
3) Core Concepts
4) Syntax Patterns (${label})
5) Step-by-Step Method
6) Common Mistakes and Fixes
7) Practice Problems (5)
8) Answer Key (Concise)
9) Quick Self-Check Quiz (5 questions + answers)

Lesson context:
- Language: ${label}
- Path: ${pathTitle || "General"}
- Lesson number: ${lessonNumber}
- Lesson title: ${lessonTitle}
- Concept summary: ${conceptSummary || "N/A"}
- Challenge prompt: ${challengePrompt || "N/A"}
- Required skills: ${requiredSkills.join(", ") || "N/A"}
- Learner struggle topics: ${struggleTopics.join(", ") || "none"}

Quality bar:
- Include concrete syntax examples in ${label}.
- Keep it practical and beginner-friendly.
- No generic filler.
- No references to switching modes or workspace navigation.`,
        },
      ],
    });

    const guide = response.content?.[0]?.text?.trim() || "";
    const invalidGuide =
      !guide ||
      guide.length < 500 ||
      /want me to switch|switch to|coding review mode/i.test(guide);

    return NextResponse.json(
      {
        success: true,
        guide: invalidGuide ? fallback : guide,
        source: invalidGuide ? "fallback" : "claude",
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { success: true, guide: fallback, source: "fallback" },
      { status: 200 }
    );
  }
}

