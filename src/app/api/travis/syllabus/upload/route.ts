// src/app/api/travis/syllabus/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractTextFromFile } from "@/lib/mirror-mode/extractText";

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

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: "File is required." },
      { status: 400 }
    );
  }

  const extracted = await extractTextFromFile(file);
  if (!extracted.ok) {
    return NextResponse.json(
      { success: false, error: extracted.error },
      { status: 400 }
    );
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are parsing a course syllabus. Extract:
- Class name
- Instructor (if present)
- Assignments with due dates (ISO), type, requirements, grading weight
Return JSON: {
  "class_name": "...",
  "instructor": "...",
  "assignments": [{
    "name": "...",
    "type": "test|quiz|paper|homework|lab|project|reading",
    "due_date": "2026-02-15",
    "requirements": {
      "page_count": 0,
      "word_count": 0,
      "min_sources": 0,
      "citation_style": "APA|MLA|Chicago|IEEE",
      "required_sections": [],
      "format": "",
      "other": ""
    },
    "grading_weight": 0.15
  }]
}`,
      },
      { role: "user", content: extracted.text },
    ],
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(
    completion.choices[0]?.message?.content || "{}"
  );

  const supabase = await createSupabaseServerClient();
  const { data, error: insertError } = await supabase
    .from("syllabi")
    .insert({
      user_id: userId,
      class_name: parsed.class_name || "Untitled class",
      file_url: null,
      file_type: file.type || null,
      parsed_data: parsed,
      confirmed: false,
    })
    .select("id, class_name, parsed_data")
    .single();

  if (insertError || !data) {
    return NextResponse.json(
      { success: false, error: insertError?.message || "Upload failed." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      syllabus: data,
      assignmentsFound: parsed.assignments?.length || 0,
      travis_message: `I found ${parsed.assignments?.length || 0} assignments. Look right to you?`,
    },
    { status: 200 }
  );
}
