import { NextRequest, NextResponse } from "next/server.js";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionMessage = {
  id: string;
  role: "ursie" | "user";
  text: string;
};

type ExtractedContext = {
  audience?: string;
  purpose?: string;
  tone?: string;
  names?: string[];
  companies?: string[];
  writing_type?: string;
};

type RevealRequestBody = {
  session_id?: string;
  conversation_history?: SessionMessage[];
  voiced_output?: string;
  extracted_context?: ExtractedContext;
  user_name?: string;
};

const FORBIDDEN_PHRASES = [
  "pressure points",
  "static",
  "voice profile",
  "mirror mode",
  "i listen for",
  "i help you",
  "my purpose is",
  "i understand",
  "i apologize",
  "i'm sorry",
  "how can i help you today",
  "great question",
  "certainly",
  "of course",
  "absolutely",
  "i am an ai",
];

function getAnthropicClient() {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error("Claude API key not configured");
  }
  return new Anthropic({ apiKey });
}

function normalizeMessages(value: unknown): SessionMessage[] {
  if (!Array.isArray(value)) return [];

  return value.filter((message): message is SessionMessage => {
    if (!message || typeof message !== "object") return false;
    const candidate = message as Record<string, unknown>;
    return (
      typeof candidate.id === "string" &&
      (candidate.role === "user" || candidate.role === "ursie") &&
      typeof candidate.text === "string"
    );
  });
}

function sentenceCount(text: string): number {
  return text
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function containsForbiddenPhrase(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_PHRASES.some((phrase) => lower.includes(phrase));
}

function validGenericLabel(text: string, userName: string): boolean {
  const normalized = text.trim();
  return (
    Boolean(normalized) &&
    normalized.toLowerCase().includes(userName.toLowerCase()) &&
    sentenceCount(normalized) <= 1 &&
    !containsForbiddenPhrase(normalized)
  );
}

function validRevealStatement(text: string, userName: string): boolean {
  const normalized = text.trim();
  return (
    Boolean(normalized) &&
    normalized.toLowerCase().includes(userName.toLowerCase()) &&
    sentenceCount(normalized) >= 1 &&
    sentenceCount(normalized) <= 4 &&
    !containsForbiddenPhrase(normalized)
  );
}

function fallbackGenericLabel(userName: string): string {
  return `${userName}. This is what the words look like before I know your hand.`;
}

function fallbackRevealStatement(
  userName: string,
  messages: SessionMessage[],
  extractedContext: ExtractedContext
): string {
  const latestUserReference =
    extractedContext.names?.[0] ||
    extractedContext.companies?.[0] ||
    extractedContext.audience ||
    extractedContext.purpose ||
    messages
      .filter((message) => message.role === "user")
      .slice(-1)[0]
      ?.text.split(/\s+/)
      .slice(0, 6)
      .join(" ") ||
    "the way you framed it";

  return `${userName}. You gave me ${latestUserReference}, and that set the register. This one moves the way your request actually moved.`;
}

function buildRevealSystemPrompt(userName: string) {
  return `
You are Ursie.

Personality and stance:
- Address the user by name when it matters. User name: ${userName}.
- You do not explain yourself. You do not market. You do not sound like a product.
- You are direct, stern, precise, and occasionally poetic when precision requires it.
- You sound like a person who heard the whole exchange and is handing something back.

Hard rules:
- Never use these phrases: pressure points, static, voice profile, Mirror Mode, I listen for, I help you, my purpose is, I understand, I apologize, I'm sorry, How can I help you today, Great question, Certainly, Of course, Absolutely, or any variation of "I am an AI".
- Generic label: exactly one sentence, contains the user's name, communicates this is what the writing looks like without knowing them yet.
- Reveal statement: 2 to 4 sentences, contains the user's name, references at least one concrete thing from the conversation, explains why the voiced output landed the way it did.
- Do not describe what you do in general. Speak only about this specific exchange and this specific draft.

Return JSON only:
{
  "generic_label": "text",
  "reveal_statement": "text"
}
`.trim();
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function generateRevealCopy(args: {
  userName: string;
  sessionMessages: SessionMessage[];
  voicedOutput: string;
  extractedContext: ExtractedContext;
  retry?: boolean;
}) {
  const anthropic = getAnthropicClient();
  const system = buildRevealSystemPrompt(args.userName);
  const prompt = `
Conversation history:
${args.sessionMessages.map((message) => `${message.role}: ${message.text}`).join("\n")}

Extracted context:
${JSON.stringify(args.extractedContext, null, 2)}

Voiced output:
${args.voicedOutput}

${args.retry ? "Your first attempt violated the rules. Fix it now." : "Write the two strings now."}
  `.trim();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 400,
    system,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n")
    .trim();

  const parsed = safeParseJson(raw);
  return {
    genericLabel:
      typeof parsed?.generic_label === "string" ? parsed.generic_label.trim() : "",
    revealStatement:
      typeof parsed?.reveal_statement === "string" ? parsed.reveal_statement.trim() : "",
  };
}

export async function POST(request: NextRequest) {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as RevealRequestBody | null;
    if (!body?.session_id || !body.voiced_output?.trim()) {
      return NextResponse.json({ error: "Invalid reveal payload" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: session, error: sessionError } = await supabase
      .from("mirror_playground_sessions")
      .select("messages")
      .eq("id", body.session_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const sessionMessages = normalizeMessages(session.messages);
    const extractedContext = body.extracted_context || {};
    const userName = body.user_name?.trim() || "You";

    let generated = await generateRevealCopy({
      userName,
      sessionMessages,
      voicedOutput: body.voiced_output.trim(),
      extractedContext,
    });

    if (
      !validGenericLabel(generated.genericLabel, userName) ||
      !validRevealStatement(generated.revealStatement, userName)
    ) {
      generated = await generateRevealCopy({
        userName,
        sessionMessages,
        voicedOutput: body.voiced_output.trim(),
        extractedContext,
        retry: true,
      });
    }

    const genericLabel = validGenericLabel(generated.genericLabel, userName)
      ? generated.genericLabel
      : fallbackGenericLabel(userName);
    const revealStatement = validRevealStatement(generated.revealStatement, userName)
      ? generated.revealStatement
      : fallbackRevealStatement(userName, sessionMessages, extractedContext);

    return NextResponse.json(
      {
        generic_label: genericLabel,
        reveal_statement: revealStatement,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Playground reveal POST error:", error);
    return NextResponse.json(
      {
        generic_label: fallbackGenericLabel("You"),
        reveal_statement: fallbackRevealStatement("You", [], {}),
      },
      { status: 200 }
    );
  }
}
