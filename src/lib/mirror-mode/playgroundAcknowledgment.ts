import Anthropic from "@anthropic-ai/sdk";

export type AcknowledgmentState = {
  redirectCount: number;
  recommendationContext?: string;
  userMessage?: string;
};

type ClaudeInput = {
  system: string;
  prompt: string;
  maxTokens: number;
};

type ClaudeDeps = {
  runClaude: (input: ClaudeInput) => Promise<string>;
};

const REDIRECT_MODEL = "claude-sonnet-4-20250514";

function getAnthropicClient() {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Anthropic({ apiKey });
}

async function defaultRunClaude(input: ClaudeInput): Promise<string> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    throw new Error("Claude API key not configured");
  }

  const response = await anthropic.messages.create({
    model: REDIRECT_MODEL,
    max_tokens: input.maxTokens,
    system: input.system,
    messages: [{ role: "user", content: input.prompt }],
  });

  return response.content?.map((part) => ("text" in part ? part.text : "")).join("\n").trim() || "";
}

const ACKNOWLEDGMENT_PATTERNS = [
  /\bgot it\b/i,
  /\bok(?:ay)?\b/i,
  /\bwill do\b/i,
  /\bi(?:'| wi)ll check\b/i,
  /\bi see it\b/i,
  /\bi saw it\b/i,
  /\bi(?:'| wi)ll look\b/i,
  /\bi(?:'| wi)ll handle\b/i,
  /\bi(?:'| wi)ll review\b/i,
  /\bthanks,?\s*i(?:'| wi)ll\b/i,
  /\bunderstood\b/i,
  /\bqueue\b/i,
  /\bclassification\b/i,
  /\bsubcategor(?:y|ies)\b/i,
];

const SUBJECT_CHANGE_PATTERNS = [
  /\bcan you\b/i,
  /\bwrite\b/i,
  /\bdraft\b/i,
  /\brewrite\b/i,
  /\bgenerate\b/i,
  /\bhelp me\b/i,
  /\bnew question\b/i,
  /\banother thing\b/i,
  /\binstead\b/i,
  /\bwhat about\b/i,
];

export function detectAcknowledgment(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) {
    return false;
  }

  const lower = trimmed.toLowerCase();
  const hasAckSignal = ACKNOWLEDGMENT_PATTERNS.some((pattern) => pattern.test(lower));
  if (!hasAckSignal) {
    return false;
  }

  const hasSubjectChange = SUBJECT_CHANGE_PATTERNS.some((pattern) => pattern.test(lower));
  const isShortAck = lower.split(/\s+/).length <= 12;

  if (hasSubjectChange && !/\bqueue\b|\bcheck\b|\breview\b|\blook\b/i.test(lower)) {
    return false;
  }

  return isShortAck || /\bqueue\b|\bcheck\b|\breview\b|\blook\b/i.test(lower);
}

function buildRedirectPrompt(state: AcknowledgmentState) {
  const recommendationContext = state.recommendationContext?.trim() || "a queued classification I surfaced";
  const userMessage = state.userMessage?.trim() || "The user changed the subject.";
  const redirectMode =
    state.redirectCount >= 3
      ? "This is the third redirect. Tell the user you will leave it there for now and that you will remember."
      : state.redirectCount === 2
        ? "This is the second redirect. Be firmer, but still warm."
        : "This is the first redirect. Be gentle, patient, and direct.";

  return [
    redirectMode,
    `Original recommendation context: ${recommendationContext}`,
    `User's new message: ${userMessage}`,
    "Write one short Ursie response.",
    "Do not apologize.",
    "Do not sound bureaucratic.",
    "Do not repeat the original recommendation word for word.",
  ].join("\n");
}

export async function generateRedirectMessageWithDeps(
  state: AcknowledgmentState,
  ursieSystemPrompt: string,
  deps: ClaudeDeps
): Promise<string> {
  const response = await deps.runClaude({
    system: ursieSystemPrompt,
    prompt: buildRedirectPrompt(state),
    maxTokens: 140,
  });

  return response.trim() || "Look at the queue item first. Then come back to this.";
}

export async function generateRedirectMessage(
  state: AcknowledgmentState,
  ursieSystemPrompt: string
): Promise<string> {
  try {
    return await generateRedirectMessageWithDeps(state, ursieSystemPrompt, {
      runClaude: defaultRunClaude,
    });
  } catch {
    if (state.redirectCount >= 3) {
      return "I will leave it there for now. I still want you to come back to it.";
    }
    if (state.redirectCount === 2) {
      return "You are skipping what I just surfaced. Look at it first, then we can move on.";
    }
    return "Before we move on, look at what I set aside in the queue.";
  }
}
