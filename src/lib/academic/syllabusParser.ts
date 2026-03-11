export type ParsedAssignment = {
  name?: string;
  type?: string | null;
  due_date?: string | null;
  requirements?: Record<string, unknown> | null;
  grading_weight?: number | null;
  parser_confidence?: number | null;
  parser_notes?: string | null;
  search_depth?: "direct" | "module_schedule" | "grade_distribution" | "llm_enriched";
};

export type ParseMetrics = {
  total_lines: number;
  non_empty_lines: number;
  section_hits: number;
  assignments_by_depth: {
    direct: number;
    module_schedule: number;
    grade_distribution: number;
    llm_enriched: number;
  };
  deepest_search_depth: 1 | 2 | 3;
};

export type ParsedSyllabus = {
  class_name: string | null;
  assignments: ParsedAssignment[];
  metrics: ParseMetrics;
};

const NUMBER_WORD_TO_INDEX: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
};

function normalizeSpace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferAssignmentType(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("project")) return "project";
  if (lower.includes("milestone")) return "milestone";
  if (lower.includes("discussion")) return "discussion";
  if (lower.includes("lab")) return "lab";
  if (lower.includes("quiz")) return "quiz";
  if (lower.includes("test") || lower.includes("exam")) return "test";
  if (lower.includes("paper") || lower.includes("essay")) return "paper";
  if (lower.includes("reading") || lower.includes("read")) return "reading";
  if (lower.includes("assignment")) return "homework";
  return "homework";
}

function cleanModuleAssignmentTitle(title: string): string {
  return normalizeSpace(title);
}

function formatModuleAssignmentTitle(
  moduleNumber: number,
  itemNumber: number,
  title: string
) {
  return `${moduleNumber}-${itemNumber} ${normalizeSpace(title)}`;
}

function isLikelyModuleRow(
  moduleNumber: number,
  itemNumber: number,
  title: string
) {
  if (!Number.isFinite(moduleNumber) || !Number.isFinite(itemNumber)) return false;
  if (moduleNumber < 1 || moduleNumber > 20) return false;
  if (itemNumber < 1 || itemNumber > 20) return false;

  const normalized = normalizeSpace(title);
  if (!normalized || normalized.length < 3) return false;
  if (!/[A-Za-z]/.test(normalized)) return false;
  if (/^[-–—:.,\s]+$/.test(normalized)) return false;
  if (/^p\s*a\s*g\s*e\b/i.test(normalized)) return false;

  return true;
}

function titleCompletenessScore(title: string | null | undefined): number {
  const normalized = normalizeSpace(title || "");
  if (!normalized) return -1000;

  let score = normalized.length;

  // Penalize clearly incomplete endings seen in broken PDF wraps.
  if (/[(:\-]\s*$/.test(normalized)) score -= 15;
  if (/\(/.test(normalized) && !/\)/.test(normalized)) score -= 25;
  if (/\b(non|student|zybooks)\s*$/i.test(normalized)) score -= 20;

  return score;
}

function pickBetterTitle(current: string, candidate: string) {
  const currentScore = titleCompletenessScore(current);
  const candidateScore = titleCompletenessScore(candidate);
  return candidateScore > currentScore ? candidate : current;
}

function extractClassName(text: string): string | null {
  const match = text.match(/\b([A-Z]{2,}\s*\d{2,}[A-Z]?)\s*:\s*([^\n]+)/);
  if (match) {
    return normalizeSpace(`${match[1]}: ${match[2]}`);
  }
  return null;
}

function parseDirectDueDateLines(lines: string[]): ParsedAssignment[] {
  const results: ParsedAssignment[] = [];
  const lineRegex =
    /^(.{3,140}?)\s+(?:due|deadline)\s*[:\-]?\s*([A-Za-z]{3,9}\.?\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(lineRegex);
    if (!match) continue;

    const name = normalizeSpace(match[1].replace(/^[\-\*\u2022]\s*/, ""));
    if (!name || name.length < 4) continue;

    results.push({
      name,
      type: inferAssignmentType(name),
      due_date: normalizeDate(match[2]),
      requirements: { source: "direct_due_date_line" },
      parser_confidence: 0.96,
      parser_notes: `Direct due-date line: "${line}"`,
      search_depth: "direct",
    });
  }

  return results;
}

function parseModuleSchedule(lines: string[]): ParsedAssignment[] {
  const results: ParsedAssignment[] = [];
  let currentModule: number | null = null;
  const assignmentLineRegex =
    /^(?:module\s+)?(\d{1,2})\s*[-–—]\s*(\d{1,2})\s+(.+)$/i;
  const moduleHeadingRegex =
    /^(?:module\s+)?(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen)\b/i;

  const isPageArtifact = (value: string) =>
    /^p\s*a\s*g\s*e\b/i.test(value) ||
    /syllabus last updated/i.test(value);

  const isContinuationLine = (value: string) => {
    if (!value) return false;
    if (moduleHeadingRegex.test(value)) return false;
    if (assignmentLineRegex.test(value)) return false;
    if (isPageArtifact(value)) return false;
    if (/^module topics and assignments/i.test(value)) return false;
    if (/^weekly assignment schedule/i.test(value)) return false;
    return true;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() || "";
    if (!line) continue;

    const moduleHeading = line.match(moduleHeadingRegex);
    if (moduleHeading) {
      currentModule = NUMBER_WORD_TO_INDEX[moduleHeading[1].toLowerCase()] ?? null;
      continue;
    }

    const assignmentLine =
      line.match(assignmentLineRegex) ||
      line.match(/(?:^|\s)(\d{1,2})\s*[-–—]\s*(\d{1,2})\s+(.+)$/i);
    if (!assignmentLine) continue;

    const moduleNumber = Number(assignmentLine[1]);
    const itemNumber = Number(assignmentLine[2]);
    let title = normalizeSpace(assignmentLine[3]);
    if (!title) continue;

    // Merge wrapped PDF lines so full syllabus titles are preserved.
    while (index + 1 < lines.length) {
      const nextLine = (lines[index + 1] || "").trim();
      if (isPageArtifact(nextLine)) {
        index += 1;
        continue;
      }
      if (!isContinuationLine(nextLine)) break;
      if (title.endsWith("-")) {
        title = `${title.slice(0, -1)}${nextLine}`;
      } else {
        title = `${title} ${nextLine}`;
      }
      title = normalizeSpace(title);
      index += 1;
    }

    if (!isLikelyModuleRow(moduleNumber, itemNumber, title)) continue;

    const cleanedTitle = cleanModuleAssignmentTitle(title);
    const resolvedModule = currentModule ?? moduleNumber;
    const moduleScopedTitle = formatModuleAssignmentTitle(
      resolvedModule,
      itemNumber,
      cleanedTitle
    );
    const lowerTitle = cleanedTitle.toLowerCase();

    const confidence = /(assignment|project|milestone|submission)/i.test(lowerTitle)
      ? 0.9
      : 0.82;
    const nonGraded = /\bnon-graded\b/i.test(title);
    const reminder = /\breminder\b/i.test(title);
    const review = /^review\b/i.test(title);
    const discussion = /\bdiscussion\b/i.test(title);

    results.push({
      name: moduleScopedTitle,
      type: inferAssignmentType(cleanedTitle),
      due_date: null,
      requirements: {
        source: "module_schedule",
        module: resolvedModule,
        item: itemNumber,
        module_reference: `${resolvedModule}-${itemNumber}`,
        original_label: title,
        non_graded: nonGraded,
        reminder,
        review,
        discussion,
      },
      parser_confidence: confidence,
      parser_notes:
        "Found in module schedule. Due date is not explicitly listed in the syllabus text.",
      search_depth: "module_schedule",
    });
  }

  return results;
}

function parseModuleScheduleFromRawText(text: string): ParsedAssignment[] {
  const results: ParsedAssignment[] = [];
  const tokenRegex = /(\d{1,2})\s*[-–—]\s*(\d{1,2})\s+/g;
  const tokens: Array<{ moduleNumber: number; itemNumber: number; start: number }> = [];
  let tokenMatch: RegExpExecArray | null;

  while ((tokenMatch = tokenRegex.exec(text)) !== null) {
    tokens.push({
      moduleNumber: Number(tokenMatch[1]),
      itemNumber: Number(tokenMatch[2]),
      start: tokenMatch.index,
    });
  }

  for (let idx = 0; idx < tokens.length; idx += 1) {
    const current = tokens[idx];
    const next = tokens[idx + 1];
    const end = next ? next.start : text.length;
    const chunk = text.slice(current.start, end);
    const prefixRegex = new RegExp(
      `^\\s*${current.moduleNumber}\\s*[-–—]\\s*${current.itemNumber}\\s+`,
      "i"
    );
    const withoutPrefix = chunk.replace(prefixRegex, "");
    const withoutArtifacts = withoutPrefix
      .replace(/P\s*a\s*g\s*e\s*\|[^\n\r]*/gi, " ")
      .replace(/Syllabus\s+Last\s+Updated[^\n\r]*/gi, " ")
      .replace(/Module\s+Topics\s+and\s+Assignments/gi, " ")
      .replace(/\bCourse\s+Participation\b[\s\S]*$/i, " ");
    const title = normalizeSpace(withoutArtifacts);
    if (!title) continue;
    if (!isLikelyModuleRow(current.moduleNumber, current.itemNumber, title)) continue;

    const cleanedTitle = cleanModuleAssignmentTitle(title);
    const moduleScopedTitle = formatModuleAssignmentTitle(
      current.moduleNumber,
      current.itemNumber,
      cleanedTitle
    );
    const nonGraded = /\bnon-graded\b/i.test(title);
    const reminder = /\breminder\b/i.test(title);
    const review = /^review\b/i.test(title);
    const discussion = /\bdiscussion\b/i.test(title);

    results.push({
      name: moduleScopedTitle,
      type: inferAssignmentType(cleanedTitle),
      due_date: null,
      requirements: {
        source: "module_schedule",
        module: current.moduleNumber,
        item: current.itemNumber,
        module_reference: `${current.moduleNumber}-${current.itemNumber}`,
        original_label: title,
        non_graded: nonGraded,
        reminder,
        review,
        discussion,
      },
      parser_confidence: 0.74,
      parser_notes:
        "Found via raw-text module scan. Due date is not explicitly listed in the syllabus text.",
      search_depth: "module_schedule",
    });
  }

  return results;
}

function parseGradeDistribution(lines: string[]): ParsedAssignment[] {
  const start = lines.findIndex((line) => /grade distribution/i.test(line));
  if (start === -1) return [];

  let end = lines.findIndex(
    (line, idx) => idx > start && /university grading system/i.test(line)
  );
  if (end === -1) {
    end = Math.min(lines.length, start + 40);
  }

  const rows = lines.slice(start + 1, end);
  const results: ParsedAssignment[] = [];
  const rowRegex = /^([A-Za-z][A-Za-z0-9 &/:\-]{3,}?)\s+(\d+)\s+(\d+)\s+(\d+)$/;

  for (const rawLine of rows) {
    const line = normalizeSpace(rawLine);
    if (!line) continue;
    if (/assignment category|number of|point value|total points|total course points/i.test(line)) {
      continue;
    }
    const match = line.match(rowRegex);
    if (!match) continue;

    const name = normalizeSpace(match[1]);
    if (/total/i.test(name)) continue;

    results.push({
      name,
      type: inferAssignmentType(name),
      due_date: null,
      requirements: {
        source: "grade_distribution",
        graded_items: Number(match[2]),
        points_per_item: Number(match[3]),
        total_points: Number(match[4]),
      },
      parser_confidence: 0.58,
      parser_notes: "Fallback extraction from grade distribution table.",
      search_depth: "grade_distribution",
    });
  }

  return results;
}

function dedupeAssignments(assignments: ParsedAssignment[]) {
  const byKey = new Map<string, ParsedAssignment>();

  for (const candidate of assignments) {
    const name = normalizeSpace(candidate.name || "");
    if (!name) continue;
    const moduleReference =
      typeof candidate.requirements?.module_reference === "string"
        ? candidate.requirements.module_reference
        : null;
    const key =
      candidate.search_depth === "module_schedule" && moduleReference
        ? `${normalizeKey(name)}::${moduleReference}`
        : normalizeKey(name);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, { ...candidate, name });
      continue;
    }

    const existingConfidence = existing.parser_confidence ?? 0;
    const candidateConfidence = candidate.parser_confidence ?? 0;

    const merged: ParsedAssignment = {
      ...existing,
      name: existing.name || name,
      type: existing.type || candidate.type || null,
      due_date: existing.due_date || candidate.due_date || null,
      requirements: existing.requirements || candidate.requirements || null,
      grading_weight: existing.grading_weight ?? candidate.grading_weight ?? null,
      parser_confidence: Math.max(existingConfidence, candidateConfidence),
      parser_notes: [existing.parser_notes, candidate.parser_notes]
        .filter(Boolean)
        .join(" | "),
      search_depth: existing.search_depth || candidate.search_depth,
    };

    if (candidateConfidence > existingConfidence) {
      if (candidate.name) {
        merged.name = pickBetterTitle(merged.name || "", candidate.name);
      }
      merged.type = candidate.type || merged.type || null;
      merged.requirements = candidate.requirements || merged.requirements || null;
      merged.due_date = candidate.due_date || merged.due_date || null;
      merged.search_depth = candidate.search_depth || merged.search_depth;
    } else if (candidate.name && merged.name) {
      // Even if confidence is lower, keep the more complete syllabus title.
      merged.name = pickBetterTitle(merged.name, candidate.name);
    }

    byKey.set(key, merged);
  }

  return Array.from(byKey.values());
}

export function parseSyllabusAssignments(text: string): ParsedSyllabus {
  const lines = text.split("\n").map((line) => line.trim());
  const nonEmptyLines = lines.filter(Boolean);
  const className = extractClassName(text);

  const directMatches = parseDirectDueDateLines(nonEmptyLines);
  const moduleMatches = dedupeAssignments([
    ...parseModuleSchedule(nonEmptyLines),
    ...parseModuleScheduleFromRawText(text),
  ]);
  let gradeMatches: ParsedAssignment[] = [];

  let merged = dedupeAssignments([...directMatches, ...moduleMatches]);
  if (merged.length === 0) {
    gradeMatches = parseGradeDistribution(nonEmptyLines);
    merged = dedupeAssignments(gradeMatches);
  }

  const metrics: ParseMetrics = {
    total_lines: lines.length,
    non_empty_lines: nonEmptyLines.length,
    section_hits: [
      /weekly assignment schedule/i.test(text),
      /module topics and assignments/i.test(text),
      /grade distribution/i.test(text),
    ].filter(Boolean).length,
    assignments_by_depth: {
      direct: directMatches.length,
      module_schedule: moduleMatches.length,
      grade_distribution: gradeMatches.length,
      llm_enriched: 0,
    },
    deepest_search_depth:
      merged.length > 0
        ? merged.some((a) => a.search_depth === "grade_distribution")
          ? 3
          : merged.some((a) => a.search_depth === "module_schedule")
          ? 2
          : 1
        : 3,
  };

  return {
    class_name: className,
    assignments: merged,
    metrics,
  };
}

export function mergeWithLlmAssignments(
  baseAssignments: ParsedAssignment[],
  llmAssignments: ParsedAssignment[]
) {
  const seeded = baseAssignments.map((assignment) => ({ ...assignment }));
  const byKey = new Map<string, ParsedAssignment>();
  for (const item of seeded) {
    if (!item.name) continue;
    byKey.set(normalizeKey(item.name), item);
  }
  const hasModuleSchedule = seeded.some(
    (item) => item.search_depth === "module_schedule"
  );

  let llmOnlyCount = 0;
  for (const llmAssignment of llmAssignments) {
    const name = normalizeSpace(llmAssignment.name || "");
    if (!name) continue;
    const key = normalizeKey(name);
    const dueDate = normalizeDate(llmAssignment.due_date);
    const existing = byKey.get(key);

    if (!existing) {
      if (hasModuleSchedule) {
        // When module schedule extraction exists, keep syllabus-shaped rows only.
        // Avoid adding global summary rows from LLM enrichment.
        continue;
      }

      const added: ParsedAssignment = {
        name,
        type: llmAssignment.type || inferAssignmentType(name),
        due_date: dueDate,
        requirements: llmAssignment.requirements || null,
        grading_weight:
          typeof llmAssignment.grading_weight === "number"
            ? llmAssignment.grading_weight
            : null,
        parser_confidence: 0.68,
        parser_notes: "Added from LLM enrichment pass.",
        search_depth: "llm_enriched",
      };
      byKey.set(key, added);
      seeded.push(added);
      llmOnlyCount += 1;
      continue;
    }

    if (!existing.type && llmAssignment.type) {
      existing.type = llmAssignment.type;
    }
    if (
      !existing.due_date &&
      dueDate &&
      existing.search_depth !== "module_schedule"
    ) {
      existing.due_date = dueDate;
    }
    if (!existing.requirements && llmAssignment.requirements) {
      existing.requirements = llmAssignment.requirements;
    }
    if (
      (existing.grading_weight === null || existing.grading_weight === undefined) &&
      typeof llmAssignment.grading_weight === "number" &&
      existing.search_depth !== "module_schedule"
    ) {
      existing.grading_weight = llmAssignment.grading_weight;
    }
    existing.parser_notes = [existing.parser_notes, "LLM enrichment reviewed this item."]
      .filter(Boolean)
      .join(" | ");
    existing.parser_confidence = Math.max(existing.parser_confidence ?? 0, 0.7);
  }

  return { assignments: seeded, llmOnlyCount };
}
