import { NextRequest } from "next/server.js";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handlePlaygroundFeedback } from "./handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAnthropicClient() {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error("Claude API key not configured");
  }
  return new Anthropic({ apiKey });
}

export async function POST(request: NextRequest) {
  return handlePlaygroundFeedback(request, {
    resolveUserId: async () => {
      const auth = await getAuthUser();
      return auth.userId ?? null;
    },
    createSupabaseServerClient,
    runClaude: async ({ system, prompt, maxTokens }) => {
      const anthropic = getAnthropicClient();
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
      });

      return response.content
        .filter((block) => block.type === "text")
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("\n")
        .trim();
    },
  });
}
