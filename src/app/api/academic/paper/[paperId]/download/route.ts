// src/app/api/academic/paper/[paperId]/download/route.ts
import { NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from "docx";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

function buildDocx(title: string, content: string) {
  const lines = content.split("\n").map((line) => line.trim());
  const paragraphs: Paragraph[] = [];
  let inCitations = false;

  lines.forEach((line, index) => {
    if (!line) return;

    const lower = line.toLowerCase();
    const isCitationHeading =
      lower === "references" ||
      lower === "works cited" ||
      lower === "bibliography";

    if (isCitationHeading) {
      inCitations = true;
      paragraphs.push(
        new Paragraph({
          text: line,
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 240 },
        })
      );
      return;
    }

    const isHeading =
      line.length < 80 &&
      (line === line.toUpperCase() || /:$/.test(line)) &&
      index > 0;

    if (isHeading && !inCitations) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/:$/, ""),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        })
      );
      return;
    }

    paragraphs.push(
      new Paragraph({
        children: [new TextRun(line)],
        spacing: { after: 200, line: 360 },
        indent: inCitations ? { left: 360, hanging: 240 } : undefined,
      })
    );
  });

  return new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: title,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 240 },
          }),
          ...paragraphs,
        ],
      },
    ],
  });
}

export async function GET(
  request: Request,
  { params }: { params: { paperId: string } }
) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: paper, error: paperError } = await supabase
    .from("academic_papers")
    .select(
      "id, topic, paper_content, checkpoint_passed, emergency_skip_used"
    )
    .eq("id", params.paperId)
    .eq("user_id", userId)
    .single();

  if (paperError || !paper) {
    return NextResponse.json(
      { success: false, error: "Paper not found." },
      { status: 404 }
    );
  }

  const allowed = paper.checkpoint_passed || paper.emergency_skip_used;
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: "Checkpoint not complete." },
      { status: 403 }
    );
  }

  const doc = buildDocx(paper.topic || "Academic Paper", paper.paper_content);
  const buffer = await Packer.toBuffer(doc);
  const filename = `${slugify(paper.topic || "academic-paper") || "academic-paper"}.docx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
