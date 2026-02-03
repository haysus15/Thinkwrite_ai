// src/app/api/study/upload/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractTextFromFile } from "@/lib/mirror-mode/extractText";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const title = String(formData.get("title") || "");
  const className = String(formData.get("className") || "");
  const topic = String(formData.get("topic") || "");

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: "File is required." },
      { status: 400 }
    );
  }

  const extractResult = await extractTextFromFile(file);
  if (!extractResult.ok) {
    return NextResponse.json(
      { success: false, error: extractResult.error },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: insertError } = await supabase
    .from("study_materials")
    .insert({
      user_id: userId,
      title: title || file.name,
      content: extractResult.text,
      file_url: null,
      file_type: file.type,
      class_name: className || null,
      topic: topic || null,
      source_type: "uploaded",
      source_id: null,
    })
    .select("id, title")
    .single();

  if (insertError || !data) {
    return NextResponse.json(
      { success: false, error: insertError?.message || "Upload failed." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, material: data },
    { status: 200 }
  );
}
