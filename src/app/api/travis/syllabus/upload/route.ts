// src/app/api/travis/syllabus/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractTextFromFile } from "@/lib/mirror-mode/extractText";
import {
  mergeWithLlmAssignments,
  parseSyllabusAssignments,
  type ParsedAssignment,
} from "@/lib/academic/syllabusParser";
import { normalizeAssignmentType } from "@/lib/academic/assignmentType";

export const runtime = "nodejs";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function normalizeDueDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseModuleRef(assignment: ParsedAssignment) {
  const requirements = assignment.requirements as Record<string, unknown> | null;
  const moduleNumber =
    typeof requirements?.module === "number" ? requirements.module : null;
  const item = typeof requirements?.item === "number" ? requirements.item : null;
  return { moduleNumber, item };
}

function sortParsedAssignments(assignments: ParsedAssignment[]) {
  return [...assignments].sort((a, b) => {
    const aRef = parseModuleRef(a);
    const bRef = parseModuleRef(b);

    if (aRef.moduleNumber !== null && bRef.moduleNumber !== null) {
      if (aRef.moduleNumber !== bRef.moduleNumber) {
        return aRef.moduleNumber - bRef.moduleNumber;
      }
      if (aRef.item !== null && bRef.item !== null && aRef.item !== bRef.item) {
        return aRef.item - bRef.item;
      }
    } else if (aRef.moduleNumber !== null) {
      return -1;
    } else if (bRef.moduleNumber !== null) {
      return 1;
    }

    const aDue = normalizeDueDate(a.due_date);
    const bDue = normalizeDueDate(b.due_date);
    if (aDue && bDue && aDue !== bDue) {
      return aDue.localeCompare(bDue);
    }
    if (aDue && !bDue) return -1;
    if (!aDue && bDue) return 1;

    return (a.name || "").localeCompare(b.name || "");
  });
}

export async function POST(request: NextRequest) {
  const { userId, error } = await getAuthUser();
  if (error || !userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
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
  if (extracted.ok === false) {
    const extractionError = extracted.error;
    return NextResponse.json(
      { success: false, error: extractionError },
      { status: 400 }
    );
  }

  const heuristic = parseSyllabusAssignments(extracted.text);

  let llmParsed: {
    class_name?: string;
    instructor?: string;
    assignments?: ParsedAssignment[];
  } = {};
  const parserWarnings: string[] = [];

  if (openai) {
    try {
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

      llmParsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    } catch (error) {
      parserWarnings.push(
        error instanceof Error
          ? `LLM enrichment failed: ${error.message}`
          : "LLM enrichment failed."
      );
    }
  } else {
    parserWarnings.push("OPENAI_API_KEY missing. Used deterministic parser only.");
  }

  const llmAssignments = Array.isArray(llmParsed.assignments)
    ? (llmParsed.assignments as ParsedAssignment[])
    : [];
  const merged = mergeWithLlmAssignments(heuristic.assignments, llmAssignments);
  const parsedAssignments = sortParsedAssignments(merged.assignments);
  heuristic.metrics.assignments_by_depth.llm_enriched = merged.llmOnlyCount;

  const parseConfidence =
    parsedAssignments.length > 0
      ? parsedAssignments.reduce(
          (sum, assignment) => sum + (assignment.parser_confidence ?? 0.5),
          0
        ) / parsedAssignments.length
      : 0;

  const className =
    llmParsed.class_name || heuristic.class_name || "Untitled class";
  const parserVersion = openai
    ? "hybrid-heuristic+gpt-4o"
    : "heuristic-v1";

  const parsed = {
    class_name: className,
    instructor: llmParsed.instructor || null,
    assignments: parsedAssignments,
    parse_metrics: heuristic.metrics,
    parse_warnings: parserWarnings,
  };

  const supabase = await createSupabaseServerClient();
  const { data, error: insertError } = await supabase
    .from("syllabi")
    .insert({
      user_id: userId,
      class_name: className,
      file_url: null,
      file_type: file.type || null,
      parsed_data: parsed,
      confirmed: false,
      status: "draft",
      parse_confidence: parseConfidence,
      parser_version: parserVersion,
    })
    .select("id, class_name, parsed_data, status")
    .single();

  if (insertError || !data) {
    return NextResponse.json(
      { success: false, error: insertError?.message || "Upload failed." },
      { status: 500 }
    );
  }

  if (parsedAssignments.length > 0) {
    const draftRows = parsedAssignments.map((assignment, index) => ({
      syllabus_id: data.id,
      user_id: userId,
      class_name: data.class_name,
      assignment_name: assignment.name || `Assignment ${index + 1}`,
      assignment_type: normalizeAssignmentType(
        assignment.type,
        assignment.name || null
      ),
      due_date: normalizeDueDate(assignment.due_date),
      requirements: assignment.requirements || null,
      grading_weight:
        typeof assignment.grading_weight === "number"
          ? assignment.grading_weight
          : null,
      parser_confidence:
        typeof assignment.parser_confidence === "number"
          ? assignment.parser_confidence
          : null,
      parser_notes:
        assignment.parser_notes ||
        (assignment.search_depth
          ? `Parsed via ${assignment.search_depth}`
          : null),
      draft_status: "parsed",
      position: index,
    }));

    const { error: draftInsertError } = await supabase
      .from("syllabus_assignment_drafts")
      .insert(draftRows);

    if (draftInsertError) {
      return NextResponse.json(
        {
          success: false,
          error: `Syllabus saved but failed to create draft assignments: ${draftInsertError.message}`,
        },
        { status: 500 }
      );
    }
  }

  // Mirror Mode: Do not ingest syllabus text into voice/archive.
  // Syllabi are reference documents, not authored writing samples.

  // Mirror Mode: Register lineage (best effort)
  try {
    await supabase
      .from("document_lineage")
      .insert({
        user_id: userId,
        original_document_id: data.id,
        studio_origin: "academic",
        current_version_id: data.id,
        version_history: [
          {
            version_type: "original",
            document_id: data.id,
            source_studio: "academic",
            document_type: "syllabus",
            created_at: new Date().toISOString(),
          },
        ],
      });
  } catch (e) {
    // Silent fail
  }

  return NextResponse.json(
    {
      success: true,
      syllabus: data,
      assignmentsFound: parsedAssignments.length,
      parseMetrics: heuristic.metrics,
      parserWarnings,
      reviewRequired: true,
      travis_message: `I found ${parsedAssignments.length} assignments (search depth ${heuristic.metrics.deepest_search_depth}/3). Review and approve before publishing.`,
    },
    { status: 200 }
  );
}
