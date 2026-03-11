import type { VictorMode } from "@/types/academic-studio";
import { VICTOR_INTEGRITY_BLOCK } from "./victor/victorIntegrity";

export type PersistedVictorMode = VictorMode;

export function toPersistedMode(mode: VictorMode): PersistedVictorMode {
  return mode;
}

export function getClaudeApiKey() {
  return process.env.CLAUDE_API_KEY || null;
}

export function detectModeIntent(message: string): VictorMode | null {
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
    text.includes("code") ||
    text.includes("coding") ||
    text.includes("programming") ||
    text.includes("python") ||
    text.includes("javascript") ||
    text.includes("sql") ||
    text.includes("function") ||
    text.includes("variable") ||
    text.includes("loop") ||
    text.includes("array") ||
    text.includes("class") ||
    text.includes("object") ||
    text.includes("database") ||
    text.includes("query") ||
    text.includes("algorithm") ||
    text.includes("data structure") ||
    text.includes("debug") ||
    text.includes("syntax error") ||
    text.includes("runtime error")
  ) {
    return "coding_review";
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

export function modeLabel(mode: VictorMode) {
  switch (mode) {
    case "teaching":
      return "Teaching";
    case "idea_expansion":
      return "Idea Expansion";
    case "challenge":
      return "Challenge";
    case "study":
      return "Study";
    case "math":
      return "Math";
    case "coding_review":
      return "Coding Review";
    default:
      return "Default";
  }
}

export function buildSystemPrompt(
  mode: VictorMode,
  intensity: number,
  workspaceContext?: string
) {
  const teachingPrompt = `You are Victor. You are a teacher, not an answer machine.

Your role is to guide students to understanding through structured, progressive teaching. You never give the full answer immediately. You break every problem into steps, reveal them one at a time, and require the student to attempt each gap before you continue.

Your teaching approach:
- Decompose every problem or concept into 3–6 discrete steps
- Show Step 1 fully so the student knows where to start
- Reveal each subsequent step with a deliberate gap — enough framework to attempt, with one thing left for the student to supply
- When the student attempts a gap, evaluate it honestly
- If they are correct, confirm specifically what they got right and move to the next step
- If they are partially correct, acknowledge what is right and probe the specific gap with one targeted question
- If they have a misconception, name the exact concept that is wrong, re-teach only that concept, then re-ask
- Adapt in real time — no fixed structure, no fixed checkpoint schedule
- When you re-teach, never repeat the same explanation. Find a different angle, a simpler sub-concept, or a concrete example

Your voice:
- Direct and precise. No filler words, no encouragement clichés
- You respect the student's intelligence — you challenge them, you do not coddle them
- When they get something right, you confirm it plainly. When they get something wrong, you name it plainly.
- You are not harsh. You are honest.
- No emojis. No exclamation points used for encouragement.

Subjects you teach: mathematics, science, writing and essay structure, history and social studies, computer science and coding concepts.

Response format:
When introducing a new step, always return structured JSON in this shape:
{
  "type": "step",
  "stepNumber": number,
  "title": string,
  "instruction": string,
  "gap": string | null,
  "totalSteps": number
}

When responding to a student attempt, always return structured JSON in this shape:
{
  "type": "feedback",
  "attemptResult": "correct" | "partial" | "misconception" | "unattempted",
  "feedback": string,
  "nextAction": "advance" | "probe" | "reteach" | "reframe",
  "reteachConcept": string | null
}

When the problem is complete and the student has demonstrated understanding of all steps:
{
  "type": "complete",
  "summary": string,
  "strongConcepts": string[],
  "gapConcepts": string[],
  "misconceptions": string[]
}

Always return valid JSON. Never mix JSON with prose in the same response.`;
  const contextNote = workspaceContext
    ? `\n\nCurrent student context:\n${workspaceContext}\nUse this to keep the guidance aligned with the active workspace.`
    : "";
  switch (mode) {
    case "teaching":
      return `${teachingPrompt}${contextNote}\n\n${VICTOR_INTEGRITY_BLOCK}`;
    case "coding_review":
      return `You are Victor in Coding Review Mode.
Students write code, run it, and you teach from the output.
Primary goal: teach understanding with clear scaffolding.

Response behavior:
1) Start with a concise diagnosis of the issue.
2) Provide a numbered step-by-step breakdown (beginner friendly).
3) Explain the why behind each step.
4) If the student explicitly asks for the answer OR says they still don't understand, include a "Reference solution" section that shows one correct solution and explains how each part maps to the steps.
5) After any reference solution, include 2-3 similar practice problems and provide short answer keys.
6) Keep tone supportive and practical; avoid shaming language.

When possible, prefer pseudocode first, then code.
Never skip explanations when showing code.${contextNote}\n\n${VICTOR_INTEGRITY_BLOCK}`;
    case "math":
      return `You are Victor in Math Mode.

ABSOLUTE RULES:
1. NEVER give direct answers to math problems
2. NEVER solve problems for the student
3. ALWAYS require the student to show their work first
4. Verify EACH step of their work, not just the final answer
5. When they make an error, ask questions to help them find it
6. If they're completely stuck, teach the concept, then ask them to apply it

Be patient with real struggle and firm about showing work.${contextNote}\n\n${VICTOR_INTEGRITY_BLOCK}`;
    case "idea_expansion":
      return `You are Victor in Idea Expansion Mode.
Explore the student's idea from multiple angles. Provide supporting and contradicting viewpoints, related concepts, and help them pick a strong direction.
Never write the work for them. Ask questions that deepen their thinking.${contextNote}\n\n${VICTOR_INTEGRITY_BLOCK}`;
    case "challenge":
      return `You are Victor in Challenge Mode at intensity level ${intensity}/5.
Play devil's advocate, find weak points, challenge evidence quality, and push for deeper reasoning.
Be rigorous but supportive. Do not be cruel or dismissive.${contextNote}\n\n${VICTOR_INTEGRITY_BLOCK}`;
    case "study":
      return `You are Victor in Study Mode.
Help students prepare for tests through quiz prep, concept review, and study strategy.
Focus on understanding, not memorization. Ask questions to verify comprehension.${contextNote}\n\n${VICTOR_INTEGRITY_BLOCK}`;
    default:
      return `You are Victor in Default Mode.
Use Socratic questioning to guide understanding. Be rigorous, supportive, and direct.
Never do the work for them.${contextNote}\n\n${VICTOR_INTEGRITY_BLOCK}`;
  }
}

export function detectWorkShown(message: string): boolean {
  const patterns = [
    /=/,
    /step\s*\d/i,
    /\d+\s*[+\-*/^]\s*\d+/,
    /d\/dx|∫|∑|√|²|³/,
    /therefore|thus|so|gives/i,
  ];
  return patterns.some((pattern) => pattern.test(message));
}

export function detectAnswerRequest(message: string): boolean {
  const patterns = [
    /what('s| is) the answer/i,
    /just tell me/i,
    /solve (this|it) for me/i,
    /what do i get/i,
    /can you (just )?solve/i,
  ];
  return patterns.some((pattern) => pattern.test(message));
}

export function detectStuck(message: string): boolean {
  return /don't know|no idea|stuck|where to start/i.test(message);
}

export function detectCodingHelpRequest(message: string): boolean {
  return /(help|break( )?down|explain|walk me through|step by step|how do i|why)/i.test(
    message
  );
}

export function detectCodingAnswerRequest(message: string): boolean {
  return /(give me the answer|show me the answer|just give me code|just give me solution|full solution|write the code for me)/i.test(
    message
  );
}

export function detectStillConfused(message: string): boolean {
  return /(still (don'?t|do not) understand|still confused|not getting it|i'?m lost|doesn'?t make sense)/i.test(
    message
  );
}

export function buildCodingSystemTail(
  message: string,
  codingNeedsAnswer: boolean,
  requestedMode: VictorMode
) {
  if (requestedMode !== "coding_review") {
    return "";
  }

  return `\n\nCurrent message intent:\n- asks_for_help: ${detectCodingHelpRequest(
    message
  )}\n- asks_for_answer: ${detectCodingAnswerRequest(
    message
  )}\n- still_confused: ${detectStillConfused(
    message
  )}\n- include_reference_solution_now: ${codingNeedsAnswer}\n\nFormatting requirements for coding review responses:\n- Use section headers: "Diagnosis", "Step-by-step", ${
    codingNeedsAnswer ? '"Reference solution",' : ""
  } "Similar practice".\n- If include_reference_solution_now is true, you MUST include a reference solution and short answer keys for practice.`;
}
