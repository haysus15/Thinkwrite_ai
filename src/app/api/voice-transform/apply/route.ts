import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { VoiceProfileService } from "@/services/voice-profile";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { userId, error: authError } = await getAuthUser();
  if (authError || !userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { content, contentType, preserveStructure = true, preserveKeywords = true } =
    await req.json();

  if (!content || !contentType) {
    return NextResponse.json(
      { success: false, error: "Missing content or contentType" },
      { status: 400 }
    );
  }

  const voiceContext = await VoiceProfileService.getGenerationContext(
    userId,
    "career"
  );

  if (!voiceContext.hasVoiceProfile || !voiceContext.readiness.isReady) {
    return NextResponse.json(
      {
        success: false,
        error: voiceContext.hasVoiceProfile
          ? voiceContext.readiness.message
          : "No voice profile found. Upload documents to Mirror Mode first.",
        confidenceLevel: voiceContext.readiness.score,
        redirectTo: "/mirror-mode",
      },
      { status: 400 }
    );
  }

  const systemPrompt = `You are a writing style transformer. Rewrite content to match a specific person's authentic writing voice while preserving meaning.

${voiceContext.promptInjection}

Rules:
${preserveStructure ? "- PRESERVE structure (headings, bullets, paragraphs)" : "- You may restructure for better flow"}
${preserveKeywords ? "- PRESERVE proper nouns, company names, technical terms" : ""}
- PRESERVE all factual information
- PRESERVE overall length (within 10%)
- Transform VOICE and STYLE, not content
- Do not add information that wasn't there
- Do not remove important details

Output ONLY the transformed content. No explanations.`;

  const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY,
  });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Transform this ${contentType.replace(/_/g, " ")} to match the voice profile:\n\n---\n${content}\n---\n\nRewrite in the user's authentic voice:`,
      },
    ],
  });

  const transformed =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  return NextResponse.json({
    success: true,
    original: content,
    transformed: transformed.trim(),
    voiceMetadata: {
      confidenceLevel: voiceContext.readiness.score,
    },
  });
}
