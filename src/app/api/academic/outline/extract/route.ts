import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuthUser } from "@/lib/auth/getAuthUser";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { success: false, error: "Missing OPENAI_API_KEY." },
      { status: 500 }
    );
  }

  const body = await request.json();
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json(
      { success: false, error: "message is required." },
      { status: 400 }
    );
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Extract the academic outline from this message and return valid JSON only.
Schema: { "topic": string, "sections": [{ "title": string, "subsections": string[] }] }
If no clear outline structure exists, return: { "error": "no_outline_found" }
Return only JSON. No explanation, no markdown, no backticks.`,
      },
      {
        role: "user",
        content: message,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content || "";

  try {
    const parsed = JSON.parse(raw);
    return NextResponse.json({ success: true, outline: parsed }, { status: 200 });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to parse extracted outline." },
      { status: 500 }
    );
  }
}
