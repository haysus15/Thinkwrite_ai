import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, createSupabaseAdmin } from "@/lib/auth/getAuthUser";
import { Errors } from "@/lib/api/errors";
import { transformResumeToDB, generateId } from "@/types/resume-builder";
import type { ResumeBuilderData } from "@/types/resume-builder";
import {
  extractSections,
  extractContactInfo,
  extractSkills,
} from "@/lib/career-studio/resumeAnalyzer";

function stripFileExtension(name: string) {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0) return name;
  return name.slice(0, dotIndex);
}

function parseBullets(text: string): string[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const bullets = lines
    .filter((line) => /^[-*•]/.test(line) || /^\d+\./.test(line))
    .filter(Boolean);

  if (bullets.length > 0) return bullets.slice(0, 12);

  const sentences = text
    .split(/\.(\s+|$)/)
    .map((line) => line.trim())
    .filter((line) => line.length > 10);

  return sentences.slice(0, 6);
}

function splitBlocks(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function parseSkillsFromSection(text: string): string[] {
  const chunks = text
    .split(/\n|\||•|·|,/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 1);

  return Array.from(new Set(chunks)).slice(0, 30);
}

function extractDateRange(line: string): string | null {
  const datePattern =
    /(?:\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\b|\b\d{4}\b)\s*(?:[-–—to]+\s*(?:Present|Current|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\b|\b\d{4}\b))?/i;
  const match = line.match(datePattern);
  return match ? match[0].trim() : null;
}

function parseTitleCompany(line: string): { jobTitle: string; company: string } {
  const clean = line.trim();
  if (!clean) return { jobTitle: "Role", company: "" };

  const pipeParts = clean.split("|").map((part) => part.trim()).filter(Boolean);
  if (pipeParts.length >= 2) {
    return { jobTitle: pipeParts[0], company: pipeParts[1] };
  }

  const dashParts = clean.split(" - ").map((part) => part.trim()).filter(Boolean);
  if (dashParts.length >= 2) {
    return { jobTitle: dashParts[0], company: dashParts[1] };
  }

  const atParts = clean.split(" at ").map((part) => part.trim()).filter(Boolean);
  if (atParts.length >= 2) {
    return { jobTitle: atParts[0], company: atParts[1] };
  }

  return { jobTitle: clean, company: "" };
}

function normalizeLocation(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const remoteMatch = trimmed.match(/remote/i);
  if (remoteMatch) return "Remote";

  const cityStateMatch = trimmed.match(/([A-Za-z .'-]+),\s*([A-Z]{2})/);
  if (cityStateMatch) {
    const city = cityStateMatch[1].trim().replace(/\s+/g, " ");
    const state = cityStateMatch[2].trim().toUpperCase();
    return `${city}, ${state}`;
  }

  const stateMatch = trimmed.match(/\b([A-Z]{2})\b/);
  if (stateMatch) {
    return stateMatch[1].toUpperCase();
  }

  return trimmed;
}

function parseLocationFromLine(line: string, dateRange?: string | null): string {
  let cleaned = line || "";
  if (dateRange) {
    cleaned = cleaned.replace(dateRange, "");
  }

  const parts = cleaned
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  const candidates = parts.length ? parts : cleaned.split("-").map((part) => part.trim()).filter(Boolean);

  const location = candidates.find((part) =>
    /,/.test(part) || /\b[A-Z]{2}\b/.test(part) || /remote/i.test(part)
  );

  return normalizeLocation(location || "");
}

function parseExperienceBlock(block: string): {
  jobTitle: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  bullets: string[];
} {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  const dateLineIndex = lines.findIndex((line) => extractDateRange(line));
  const dateRange = dateLineIndex >= 0 ? extractDateRange(lines[dateLineIndex]) : null;

  const titleLine = dateLineIndex > 0 ? lines[dateLineIndex - 1] : lines[0] || "";
  const companyLine = dateLineIndex > 1 ? lines[dateLineIndex - 2] : "";
  const locationLine = dateLineIndex >= 0 ? lines[dateLineIndex] : "";

  const titleCompany = parseTitleCompany(titleLine);
  const companyValue = companyLine && companyLine !== titleLine ? companyLine : titleCompany.company;
  const locationValue =
    parseLocationFromLine(locationLine, dateRange) ||
    parseLocationFromLine(companyLine) ||
    parseLocationFromLine(titleLine);

  const bulletsSource = lines
    .slice(Math.max(dateLineIndex + 1, 1))
    .join("\n");

  const bullets = parseBullets(bulletsSource);

  const [startDate = "", endDate = ""] = dateRange
    ? dateRange.split(/[-–—to]+/).map((part) => part.trim())
    : ["", ""];

  return {
    jobTitle: titleCompany.jobTitle || "Role",
    company: companyValue || "",
    location: locationValue || "",
    startDate,
    endDate,
    bullets,
  };
}

function buildDraftFromText(userId: string, fileName: string, resumeText: string): ResumeBuilderData {
  const sections = extractSections(resumeText);
  const contact = extractContactInfo(resumeText);
  const skills = extractSkills(resumeText);

  const summarySection = sections.find((section) => section.type === "summary");
  const experienceSection = sections.find((section) => section.type === "experience");
  const educationSection = sections.find((section) => section.type === "education");
  const skillsSection = sections.find((section) => section.type === "skills");
  const certificationsSection = sections.find((section) => section.type === "certifications");

  const summary = summarySection?.content?.trim() || "";

  const experienceBlocks = experienceSection ? splitBlocks(experienceSection.content) : [];
  const educationBlocks = educationSection ? splitBlocks(educationSection.content) : [];
  const certificationsLines = certificationsSection
    ? certificationsSection.content.split("\n").map((line) => line.trim()).filter(Boolean)
    : [];
  const skillsFromSection = skillsSection ? parseSkillsFromSection(skillsSection.content) : [];

  return {
    userId,
    title: `${stripFileExtension(fileName)} (Imported)`
      .replace(/\s+/g, " ")
      .trim(),
    targetRole: "",
    targetIndustry: "",
    contactInfo: {
      name: resumeText.split("\n").map((line) => line.trim()).filter(Boolean)[0] || "",
      email: contact.email || "",
      phone: contact.phone || "",
      location: contact.location || "",
      linkedin: contact.linkedin || "",
      website: "",
    },
    summary,
    experience: experienceBlocks.length
      ? experienceBlocks.slice(0, 4).map((block) => {
          const parsed = parseExperienceBlock(block);
          return {
            id: generateId(),
            jobTitle: parsed.jobTitle,
            company: parsed.company,
            location: parsed.location,
            startDate: parsed.startDate,
            endDate: parsed.endDate,
            isCurrent: /present|current/i.test(parsed.endDate),
            bullets: parsed.bullets,
          };
        })
      : [],
    education: educationBlocks.length
      ? educationBlocks.slice(0, 2).map((block) => {
          const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
          return {
            id: generateId(),
            degree: lines[0] || "Education",
            institution: lines[1] || "",
            location: "",
            graduationDate: "",
          };
        })
      : [],
    skills: (skillsFromSection.length || skills.length)
      ? [
          {
            id: generateId(),
            category: "Skills",
            skills: (skillsFromSection.length ? skillsFromSection : skills).slice(0, 25),
          },
        ]
      : [],
    projects: [],
    certifications: certificationsLines.length
      ? certificationsLines.slice(0, 5).map((line) => ({
          id: generateId(),
          name: line,
          issuer: "",
          date: "",
        }))
      : [],
    sectionStatuses: {
      contact: contact.email || contact.phone ? "draft" : "empty",
      summary: summary.length > 0 ? "draft" : "empty",
      experience: experienceBlocks.length > 0 ? "draft" : "empty",
      education: educationBlocks.length > 0 ? "draft" : "empty",
      skills: (skillsFromSection.length || skills.length) > 0 ? "draft" : "empty",
      projects: "empty",
      certifications: certificationsLines.length > 0 ? "draft" : "empty",
    },
    sectionFeedback: {},
    isDraft: true,
    isMasterResume: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rawImportedText: resumeText,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return Errors.unauthorized();
    }

    const body = await request.json();
    const resumeId = String(body?.resumeId || "").trim();

    if (!resumeId) {
      return Errors.missingField("resumeId");
    }

    const supabase = createSupabaseAdmin();

    const { data: resume, error: resumeError } = await supabase
      .from("user_documents")
      .select("id, file_name, extracted_text")
      .eq("id", resumeId)
      .eq("user_id", userId)
      .single();

    if (resumeError || !resume) {
      return Errors.notFound("Resume");
    }

  const resumeText = (resume.extracted_text || "").trim();
  if (!resumeText) {
    return Errors.validationError("This resume has no extracted text to import.");
  }

  const draft = buildDraftFromText(userId, resume.file_name || "Resume", resumeText);
  const dbData = transformResumeToDB(draft);

  const { data, error } = await supabase
    .from("user_documents")
    .insert({
      ...dbData,
      extracted_text: resumeText,
      file_name: draft.title || "Untitled Resume",
      file_type: "builder",
      source: "builder",
      is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !data) {
      return Errors.databaseError(error?.message || "Failed to create resume draft");
    }

    return NextResponse.json({
      success: true,
      resume: { ...draft, id: data.id, userId },
    });
  } catch (error: any) {
    console.error("[Resume builder import POST]:", error?.message || error);
    return Errors.internal();
  }
}
