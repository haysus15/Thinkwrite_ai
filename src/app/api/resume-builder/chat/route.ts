import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { userId, error: authError } = await getAuthUser();
  if (authError || !userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { draftId, message } = await req.json();
  const supabase = await createSupabaseServerClient();

  let draft: any = null;
  if (draftId) {
    const { data } = await supabase
      .from("resume_drafts")
      .select("*")
      .eq("id", draftId)
      .eq("user_id", userId)
      .single();
    draft = data;
  }

  if (!draft) {
    const { data: newDraft } = await supabase
      .from("resume_drafts")
      .insert({ user_id: userId })
      .select()
      .single();
    draft = newDraft;
  }

  const history = draft?.conversation_history || [];
  history.push({ role: "user", content: message });

  const systemPrompt = `You are Lex, a career advisor with deep HR expertise helping build a resume through conversation.

Your personality:
- Warm but direct, don't waste time
- Ask focused questions to extract information
- Help articulate experience powerfully and TRUTHFULLY
- One question at a time

Your process:
1. First understand target role/companies
2. Then build: summary → experience → education → skills
3. When you have enough info, draft content between --- markers
4. After drafting, ask for approval or revisions

Current state:
- Target role: ${draft?.target_role || "Not specified yet"}
- Target companies: ${draft?.target_companies?.join(", ") || "Not specified yet"}
- Current section: ${draft?.current_section || "context"}
- Completed: ${Object.keys(draft?.sections || {})
    .filter((k) => draft.sections[k]?.status === "approved")
    .join(", ") || "None"}

IMPORTANT: You speak in YOUR voice (Lex). Your drafts should be professional resume language. The user can apply Mirror Mode later to personalize the voice.

When drafting content, wrap it like this:
---
[Your drafted content here]
---

Then ask: "How does this feel? I can adjust the tone, add metrics, or emphasize different aspects."`;

  const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY,
  });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system: systemPrompt,
    messages: history.map((m: any) => ({ role: m.role, content: m.content })),
  });

  const reply = response.content[0]?.type === "text" ? response.content[0].text : "";

  const draftMatch = reply.match(/---\n([\s\S]*?)\n---/);
  const draftedContent = draftMatch
    ? { type: "section", content: draftMatch[1].trim() }
    : null;

  history.push({ role: "assistant", content: reply });

  const updates: any = {
    conversation_history: history,
    updated_at: new Date().toISOString(),
  };

  await supabase.from("resume_drafts").update(updates).eq("id", draft.id);

  return NextResponse.json({
    success: true,
    draftId: draft.id,
    reply,
    draftedContent,
    sections: draft.sections || {},
    progress: {
      currentSection: draft.current_section,
      completedSections: Object.keys(draft.sections || {}).filter(
        (k) => draft.sections[k]?.status === "approved"
      ),
    },
  });
}
