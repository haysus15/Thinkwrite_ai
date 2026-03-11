"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FilePlus, Lock, MessageSquare, Unlock } from "lucide-react";
import {
  useVictorChatOptional,
  type VictorMessage,
} from "../victor-chat/VictorChatContext";
import AcademicEmptyState from "../shared/AcademicEmptyState";
import AcademicErrorState from "../shared/AcademicErrorState";

type ConfidenceLevel = "solid" | "somewhat_clear" | "unsure";
type RelevanceLevel = "strong" | "partial" | "weak" | "unrelated" | null;

type SectionSource = {
  id: string;
  title: string;
  author: string | null;
  publication: string | null;
  year: number | null;
  notes: string | null;
  relevanceLevel: RelevanceLevel;
  relevanceExplanation: string | null;
  sectionFit: string | null;
  gaps: string | null;
  suggestedUsage: string | null;
  evaluatedAt: string | null;
};

type StudentDeclaration = {
  argument: string;
  main_points: string;
  assignment_understanding: string;
};

interface OutlineBuilderProps {
  outlineId?: string | null;
  assignmentId?: string | null;
  onOutlineSaved?: () => void;
  onContinue: (outlineId: string) => void;
}

type OutlineSection = {
  id: string;
  title: string;
  mainPoints: string;
  victorConfirmed: boolean;
  victorConfirmedAt: string | null;
  sources: SectionSource[];
};

type ExtractedOutline = {
  topic?: string;
  sections?: Array<{
    title?: string;
    subsections?: string[];
  }>;
  error?: string;
};

type OutlineExtractionResult = {
  success: boolean;
  confidence: "high" | "medium" | "low" | "failed";
  sections: Array<Pick<OutlineSection, "id" | "title" | "mainPoints">>;
  missingFields: string[];
  topic: string;
};

type AssignmentDetails = {
  assignment_name?: string | null;
  assignment_type?: string | null;
  class_name?: string | null;
  due_date?: string | null;
  grading_weight?: number | null;
  requirements?: Record<string, unknown> | null;
};

type SourceRequirements = {
  sourcesRequired: boolean;
  minimumCount: number | null;
  sourceTypes: string[];
  citationFormat: string | null;
  detected_from: "requirements" | "declaration" | "both" | "none";
};

function messageContainsOutline(message: string): boolean {
  const sectionPatterns = [/^\d+\.\s+.{10,}/m, /^#{1,3}\s+.{5,}/m, /^[IVX]+\.\s+.{5,}/m];
  const hasPattern = sectionPatterns.some((pattern) => pattern.test(message));
  const hasMinimumLines = (message.match(/\n/g) || []).length >= 4;
  return hasPattern && hasMinimumLines;
}

function defaultSections(): OutlineSection[] {
  return [1, 2, 3].map((n) => ({
    id: `section_${n}`,
    title: "",
    mainPoints: "",
    victorConfirmed: false,
    victorConfirmedAt: null,
    sources: [],
  }));
}

function requirementsToPlainText(requirements: Record<string, unknown> | null): string {
  if (!requirements) return "";
  const entries = Object.entries(requirements)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => {
      const normalized =
        typeof value === "string"
          ? value
          : Array.isArray(value)
            ? value.join(", ")
            : JSON.stringify(value);
      return `${key.replace(/_/g, " ")}: ${normalized}`;
    });
  return entries.join("\n");
}

function minimumLength(value: string, min: number): boolean {
  return value.trim().length >= min;
}

export default function OutlineBuilder({
  outlineId,
  assignmentId,
  onOutlineSaved,
  onContinue,
}: OutlineBuilderProps) {
  const victorChat = useVictorChatOptional();
  const [localMessages, setLocalMessages] = useState<VictorMessage[]>([]);
  const messages = victorChat?.messages ?? localMessages;
  const setMessages = victorChat?.setMessages ?? setLocalMessages;
  const conversationId = victorChat?.conversationId ?? null;
  const setConversationId =
    victorChat?.setConversationId ?? (() => null);
  const coachingProfile = victorChat?.coachingProfile ?? "tutor";
  const latestVictorMessage = useMemo(() => {
    return [...messages].reverse().find((message) => message.role === "assistant");
  }, [messages]);
  const latestAssistantOutlineMessage = useMemo(
    () =>
      latestVictorMessage?.content && messageContainsOutline(latestVictorMessage.content)
        ? latestVictorMessage.content
        : "",
    [latestVictorMessage]
  );

  const [savedOutlineId, setSavedOutlineId] = useState<string | null>(outlineId || null);
  const [topic, setTopic] = useState("");
  const [assignmentType, setAssignmentType] = useState("");
  const [className, setClassName] = useState("");
  const [thesis, setThesis] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [sections, setSections] = useState<OutlineSection[]>(defaultSections);
  const [conversationHistory, setConversationHistory] = useState<unknown[]>([]);

  const [declaration, setDeclaration] = useState<StudentDeclaration>({
    argument: "",
    main_points: "",
    assignment_understanding: "",
  });
  const [declarationCompleted, setDeclarationCompleted] = useState(false);

  const [sectionConfidence, setSectionConfidence] = useState<Record<string, ConfidenceLevel>>(
    {}
  );
  const [understandingDraft, setUnderstandingDraft] = useState<Record<string, string>>({});
  const [understandingFeedback, setUnderstandingFeedback] = useState<Record<string, string>>({});
  const [understandingOutcome, setUnderstandingOutcome] = useState<
    Record<string, "confirmed" | "gap" | "misalignment">
  >({});
  const [sourceRequirements, setSourceRequirements] = useState<SourceRequirements | null>(null);
  const [sourceDrafts, setSourceDrafts] = useState<
    Record<
      string,
      {
        title: string;
        author: string;
        publication: string;
        year: string;
        notes: string;
      }
    >
  >({});
  const [evaluatingSourceFor, setEvaluatingSourceFor] = useState<string | null>(null);

  const [assignmentDetails, setAssignmentDetails] = useState<AssignmentDetails | null>(null);
  const [requirementsOpen, setRequirementsOpen] = useState(true);

  const [unlocked, setUnlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingSection, setCheckingSection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] =
    useState<OutlineExtractionResult | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setRequirementsOpen(window.innerWidth >= 1024);
  }, []);

  const assignmentUnderstanding = declaration.assignment_understanding;

  useEffect(() => {
    if (!assignmentId) return;
    let active = true;
    const loadAssignment = async () => {
      try {
        const response = await fetch(`/api/travis/assignment/${assignmentId}`);
        const data = await response.json();
        if (!response.ok || !data?.assignment || !active) return;
        const assignment = data.assignment as AssignmentDetails;
        setAssignmentDetails(assignment);
        if (!assignmentUnderstanding.trim()) {
          const summary = requirementsToPlainText(assignment.requirements || null);
          if (summary.trim()) {
            setDeclaration((prev) => ({ ...prev, assignment_understanding: summary }));
          }
        }
      } catch {
        if (!active) return;
        setError(
          "Could not load assignment requirements. Check your connection and try again."
        );
      }
    };
    void loadAssignment();
    return () => {
      active = false;
    };
  }, [assignmentId, assignmentUnderstanding]);

  useEffect(() => {
    if (!outlineId) return;
    let active = true;
    const loadOutline = async () => {
      try {
        const response = await fetch(`/api/academic/outline/${outlineId}`);
        const data = await response.json();
        if (!response.ok || !data?.outline || !active) return;
        const outline = data.outline as {
          topic?: string | null;
          assignment_type?: string | null;
          class_name?: string | null;
          outline_structure?: {
            thesis?: string;
            conclusion?: string;
            sections?: Array<{
              id?: string;
              title?: string;
              main_points?: string[];
              victor_confirmed?: boolean;
              victor_confirmed_at?: string | null;
              sources?: unknown[];
            }>;
          };
          conversation_history?: unknown[];
          student_declaration?: {
            argument?: string;
            main_points?: string;
            assignment_understanding?: string;
          } | null;
          section_confidence?: Record<string, ConfidenceLevel> | null;
          source_requirements?: SourceRequirements | null;
        };

        setSavedOutlineId(outlineId);
        setTopic(outline.topic || "");
        setAssignmentType(outline.assignment_type || "");
        setClassName(outline.class_name || "");
        setThesis(outline.outline_structure?.thesis || "");
        setConclusion(outline.outline_structure?.conclusion || "");

        const incoming = Array.isArray(outline.outline_structure?.sections)
          ? outline.outline_structure.sections
          : [];
        if (incoming.length > 0) {
          setSections(
            incoming.map((section, index) => ({
              id: section.id || `section_${index + 1}`,
              title: section.title || "",
              mainPoints: Array.isArray(section.main_points)
                ? section.main_points.join("\n")
                : "",
              victorConfirmed: Boolean(section.victor_confirmed),
              victorConfirmedAt: section.victor_confirmed_at || null,
              sources: Array.isArray(section.sources)
                ? (section.sources as SectionSource[])
                : [],
            }))
          );
          setUnlocked(true);
        }

        if (Array.isArray(outline.conversation_history)) {
          setConversationHistory(outline.conversation_history);
        }

        if (outline.student_declaration) {
          const nextDeclaration: StudentDeclaration = {
            argument: outline.student_declaration.argument || "",
            main_points: outline.student_declaration.main_points || "",
            assignment_understanding:
              outline.student_declaration.assignment_understanding || "",
          };
          setDeclaration(nextDeclaration);
          setDeclarationCompleted(
            minimumLength(nextDeclaration.argument, 20) &&
              minimumLength(nextDeclaration.main_points, 20) &&
              minimumLength(nextDeclaration.assignment_understanding, 20)
          );
        }

        if (outline.section_confidence && typeof outline.section_confidence === "object") {
          setSectionConfidence(outline.section_confidence);
        }
        if (outline.source_requirements && typeof outline.source_requirements === "object") {
          setSourceRequirements(outline.source_requirements);
        }
      } catch {
        if (!active) return;
        setError(
          "Your saved outline could not be loaded. Start from the declaration step and save again."
        );
      }
    };

    void loadOutline();
    return () => {
      active = false;
    };
  }, [outlineId]);

  useEffect(() => {
    setSavedOutlineId(outlineId || null);
  }, [outlineId]);

  const parseVictorOutline = (text: string) => {
    const getLine = (label: string) => {
      const match = text.match(new RegExp(`${label}:\\s*(.+)`, "i"));
      return match ? match[1].trim() : "";
    };

    const nextTopic = getLine("Topic");
    const nextThesis = getLine("Thesis");
    const nextConclusion = getLine("Conclusion");
    const nextClass = getLine("Class");
    const nextAssignmentType = getLine("Assignment type");
    const nextSections = [1, 2, 3].map((index) => ({
      id: `section_${index}`,
      title: getLine(`Section ${index}`),
      mainPoints: getLine(`Section ${index} points`) || "",
      victorConfirmed: false,
      victorConfirmedAt: null,
      sources: [],
    }));

    return {
      topic: nextTopic,
      thesis: nextThesis,
      conclusion: nextConclusion,
      className: nextClass,
      assignmentType: nextAssignmentType,
      sections: nextSections,
    };
  };

  const mapExtractionResult = (outline: ExtractedOutline | null): OutlineExtractionResult => {
    const extractedSections = Array.isArray(outline?.sections)
      ? outline.sections.map((section, index) => ({
          id: `section_${index + 1}`,
          title: (section?.title || "").trim() || `Section ${index + 1}`,
          mainPoints: Array.isArray(section?.subsections)
            ? section.subsections.filter(Boolean).join("\n")
            : "",
        }))
      : [];

    const missingFields: string[] = [];
    if (!outline?.topic?.trim()) missingFields.push("topic");
    if (extractedSections.length < 3) missingFields.push("sections");
    if (extractedSections.some((section) => !section.mainPoints.trim())) {
      missingFields.push("section_points");
    }

    let confidence: OutlineExtractionResult["confidence"] = "failed";
    if (extractedSections.length >= 3 && missingFields.length === 0) {
      confidence = "high";
    } else if (extractedSections.length >= 2) {
      confidence = missingFields.length <= 1 ? "medium" : "low";
    } else if (extractedSections.length >= 1) {
      confidence = "low";
    }

    return {
      success: confidence !== "failed",
      confidence,
      sections: extractedSections,
      missingFields,
      topic: outline?.topic?.trim() || "",
    };
  };

  const extractOutlineFromMessage = async (
    rawMessage: string
  ): Promise<OutlineExtractionResult> => {
    const response = await fetch("/api/academic/outline/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: rawMessage }),
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        confidence: "failed",
        sections: [],
        missingFields: ["sections", "topic"],
        topic: "",
      };
    }
    const outline = data?.outline as ExtractedOutline | undefined;
    if (!outline || outline.error) {
      return {
        success: false,
        confidence: "failed",
        sections: [],
        missingFields: ["sections", "topic"],
        topic: "",
      };
    }
    return mapExtractionResult(outline);
  };

  const buildAssignmentTemplate = (): OutlineSection[] => {
    const normalizedType = assignmentType.toLowerCase();
    if (normalizedType.includes("research")) {
      return [
        {
          id: "section_1",
          title: "Introduction and Research Question",
          mainPoints: "Context\nResearch question\nThesis statement",
          victorConfirmed: false,
          victorConfirmedAt: null,
          sources: [],
        },
        {
          id: "section_2",
          title: "Evidence and Analysis",
          mainPoints: "Key evidence\nInterpretation\nCounterargument",
          victorConfirmed: false,
          victorConfirmedAt: null,
          sources: [],
        },
        {
          id: "section_3",
          title: "Conclusion",
          mainPoints: "Synthesis\nImplications\nNext steps",
          victorConfirmed: false,
          victorConfirmedAt: null,
          sources: [],
        },
      ];
    }
    return [
      {
        id: "section_1",
        title: "Introduction",
        mainPoints: "Hook\nContext\nThesis statement",
        victorConfirmed: false,
        victorConfirmedAt: null,
        sources: [],
      },
      {
        id: "section_2",
        title: "Body",
        mainPoints: "Main claim\nEvidence\nAnalysis",
        victorConfirmed: false,
        victorConfirmedAt: null,
        sources: [],
      },
      {
        id: "section_3",
        title: "Conclusion",
        mainPoints: "Restate thesis\nKey takeaway\nClosing insight",
        victorConfirmed: false,
        victorConfirmedAt: null,
        sources: [],
      },
    ];
  };

  const applyVictorOutline = async () => {
    if (!latestVictorMessage?.content) return;
    setError(null);
    setInfo(null);
    setExtractionResult(null);

    const extracted = await extractOutlineFromMessage(latestVictorMessage.content);
    setExtractionResult(extracted);

    if (extracted.confidence === "failed") {
      setUnlocked(false);
      setError(
        "Victor's outline could not be parsed automatically. See recovery options below."
      );
      return;
    }

    if (extracted.confidence === "low") {
      setUnlocked(false);
      setInfo(
        "We found part of your outline, but some sections are incomplete. Choose a recovery option."
      );
      setSections(
        extracted.sections.length > 0
          ? extracted.sections.map((section, index) => ({
              ...section,
              id: section.id || `section_${index + 1}`,
              victorConfirmed: false,
              victorConfirmedAt: null,
              sources: [],
            }))
          : defaultSections()
      );
      if (extracted.topic) setTopic(extracted.topic);
      return;
    }

    if (extracted.confidence === "medium") {
      setInfo("Some sections may need review — check each one before continuing.");
    }

    if (!extracted || extracted.sections.length < 2) {
      const parsed = parseVictorOutline(latestVictorMessage.content);
      if (parsed.topic) setTopic(parsed.topic);
      if (parsed.thesis) setThesis(parsed.thesis);
      if (parsed.conclusion) setConclusion(parsed.conclusion);
      if (parsed.className) setClassName(parsed.className);
      if (parsed.assignmentType) setAssignmentType(parsed.assignmentType);
      if (parsed.sections.some((section) => section.title || section.mainPoints)) {
        setSections(parsed.sections);
      }
      setUnlocked(true);
      setInfo(
        "We could not extract your outline automatically. Fill in the sections below or ask Victor to reformat it."
      );
      return;
    }

    if (extracted.topic.trim()) {
      setTopic(extracted.topic.trim());
    }
    setSections(
      extracted.sections.map((section, index) => ({
        id: section.id || `section_${index + 1}`,
        title: section.title,
        mainPoints: section.mainPoints,
        victorConfirmed: false,
        victorConfirmedAt: null,
        sources: [],
      }))
    );
    setUnlocked(true);
  };

  const declarationIsValid =
    minimumLength(declaration.argument, 20) &&
    minimumLength(declaration.main_points, 20) &&
    minimumLength(declaration.assignment_understanding, 20);

  const buildOutlinePayload = () => ({
    thesis,
    sections: sections.map((section) => ({
      id: section.id,
      title: section.title,
      main_points: section.mainPoints
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      evidence: [],
      victor_confirmed: section.victorConfirmed,
      victor_confirmed_at: section.victorConfirmedAt,
      sources: Array.isArray(section.sources) ? section.sources : [],
    })),
    conclusion,
  });

  const persistOutline = async (targetOutlineId: string, patchOnly = false) => {
    const response = await fetch(`/api/academic/outline/${targetOutlineId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        assignmentType,
        className,
        outline: buildOutlinePayload(),
        conversationHistory,
        studentDeclaration: declaration,
        sectionConfidence,
        sourceRequirements,
      }),
    });
    const data = await response.json();
    if (!response.ok && !patchOnly) {
      throw new Error(data?.error || "Failed to save outline.");
    }
    if (!response.ok && patchOnly) {
      throw new Error(data?.error || "Your update could not be saved.");
    }
  };

  const saveOutline = async () => {
    if (!topic.trim() || !thesis.trim()) {
      setError("Add a topic and thesis before saving.");
      return;
    }
    if (!declarationCompleted) {
      setError("Complete the declaration step before saving your outline.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      if (savedOutlineId) {
        await persistOutline(savedOutlineId);
        onOutlineSaved?.();
        setInfo("Outline updated.");
      } else {
        const response = await fetch("/api/academic/outline/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic,
            assignmentType,
            className,
            assignmentId,
            studentDeclaration: declaration,
            sectionConfidence,
            sourceRequirements,
            conversationHistory,
            outline: buildOutlinePayload(),
          }),
        });
        const data = await response.json();
        if (!response.ok || !data?.outlineId) {
          throw new Error(data?.error || "Failed to save outline.");
        }
        setSavedOutlineId(data.outlineId);
        onOutlineSaved?.();
        setInfo("Outline saved. Complete section checks, then continue to generation.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Your outline could not be saved. Check your connection and try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const submitDeclaration = async () => {
    if (!declarationIsValid) {
      setError("Each declaration response must be at least 20 characters.");
      return;
    }
    setError(null);
    setDeclarationCompleted(true);
    setUnlocked(true);

    try {
      const sourceResponse = await fetch("/api/academic/paper/source-requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentRequirements: assignmentDetails?.requirements || null,
          studentDeclaration: `${declaration.argument}\n${declaration.main_points}\n${declaration.assignment_understanding}`,
          paperType: assignmentType || assignmentDetails?.assignment_type || null,
        }),
      });
      const sourceData = await sourceResponse.json();
      if (sourceResponse.ok && sourceData?.sourceRequirements) {
        setSourceRequirements(sourceData.sourceRequirements as SourceRequirements);
      }
    } catch {
      setError(
        "Source requirements could not be detected right now. Continue outlining and try again after saving."
      );
    }

    if (!savedOutlineId) {
      try {
        const draftResponse = await fetch("/api/academic/outline/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: topic.trim() || declaration.argument.trim().slice(0, 160) || "Draft topic",
            assignmentType,
            className,
            assignmentId,
            studentDeclaration: declaration,
            sectionConfidence,
            sourceRequirements,
            conversationHistory,
            outline: buildOutlinePayload(),
          }),
        });
        const draftData = await draftResponse.json();
        if (!draftResponse.ok || !draftData?.outlineId) {
          throw new Error(
            draftData?.error ||
              "Your declaration was captured, but draft creation failed. Save your outline to persist."
          );
        }
        setSavedOutlineId(draftData.outlineId);
        onOutlineSaved?.();
        setInfo("Declaration saved. Continue building your outline.");
      } catch (err) {
        setInfo(
          err instanceof Error
            ? err.message
            : "Declaration captured. Save your outline to persist it."
        );
      }
      return;
    }

    try {
      await persistOutline(savedOutlineId, true);
      setInfo("Declaration saved.");
    } catch {
      setError(
        "Your declaration could not be saved to this assignment yet. Your local progress is still available."
      );
    }
  };

  const allSectionsRated = sections.every((section) => Boolean(sectionConfidence[section.id]));

  const submitUnderstandingCheck = async (sectionId: string) => {
    const explanation = (understandingDraft[sectionId] || "").trim();
    if (explanation.length < 30) {
      setError("Section explanation must be at least 30 characters.");
      return;
    }
    if (!savedOutlineId) {
      setError("Save your outline before submitting section checks.");
      return;
    }

    const section = sections.find((item) => item.id === sectionId);
    if (!section) return;

    setCheckingSection(sectionId);
    setError(null);

    try {
      const prompt = `Section understanding check:\nSection: ${section.title || section.id}\nMy explanation: ${explanation}`;
      setMessages((prev) => [
        ...prev,
        { role: "user", content: prompt, timestamp: new Date().toISOString() },
      ]);

      const response = await fetch("/api/victor/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          conversationId: conversationId || undefined,
          mode: "study",
          workspaceContext: "Paper workflow · section understanding check",
          coachingProfile,
          assignmentId: assignmentId || null,
          victorContext: {
            sectionTitle: section.title,
            sectionBody: section.mainPoints,
            assignmentRequirements: assignmentDetails?.requirements || null,
            assignmentName: assignmentDetails?.assignment_name || "Current assignment",
            className: assignmentDetails?.class_name || className,
            paperType: assignmentDetails?.assignment_type || assignmentType || null,
            studentDeclaration: declaration,
            unsureSections: Object.entries(sectionConfidence)
              .filter(([, value]) => value === "unsure")
              .map(([id]) => sections.find((item) => item.id === id)?.title || id),
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Section check failed.");
      }
      if (typeof data?.conversationId === "string") {
        setConversationId(data.conversationId);
      }

      const victorReply =
        typeof data?.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : "I need more detail to confirm this section.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: victorReply,
          timestamp: new Date().toISOString(),
          misconceptionLevel: data?.misconceptionLevel,
        },
      ]);

      const misconceptionLevel = data?.misconceptionLevel as
        | "none"
        | "partial"
        | "fundamental"
        | undefined;
      const outcome =
        misconceptionLevel === "fundamental"
          ? "misalignment"
          : misconceptionLevel === "partial"
            ? "gap"
            : "confirmed";

      const now = new Date().toISOString();
      const nextSections = sections.map((item) => {
        if (item.id !== sectionId) return item;
        if (outcome === "confirmed") {
          return { ...item, victorConfirmed: true, victorConfirmedAt: now };
        }
        return { ...item, victorConfirmed: false, victorConfirmedAt: null };
      });
      setSections(nextSections);

      const historyItem = {
        type: "understanding_check",
        section_id: sectionId,
        student_explanation: explanation,
        victor_response: victorReply,
        outcome,
        timestamp: now,
      };
      const nextHistory = [...conversationHistory, historyItem];
      setConversationHistory(nextHistory);
      setUnderstandingFeedback((prev) => ({ ...prev, [sectionId]: victorReply }));
      setUnderstandingOutcome((prev) => ({ ...prev, [sectionId]: outcome }));

      if (outcome !== "confirmed") {
        setInfo(
          outcome === "gap"
            ? "Victor found a gap in this section. Revise your explanation and submit again before continuing."
            : "Victor flagged a misalignment with your thesis. Update this section and resubmit before continuing."
        );
      }

      const persistResponse = await fetch(`/api/academic/outline/${savedOutlineId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          assignmentType,
          className,
          outline: {
            thesis,
            sections: nextSections.map((item) => ({
              id: item.id,
              title: item.title,
              main_points: item.mainPoints
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
              evidence: [],
              victor_confirmed: item.victorConfirmed,
              victor_confirmed_at: item.victorConfirmedAt,
              sources: item.sources,
            })),
            conclusion,
          },
          conversationHistory: nextHistory,
          studentDeclaration: declaration,
          sectionConfidence,
          sourceRequirements,
        }),
      });
      const persistData = await persistResponse.json();
      if (!persistResponse.ok) {
        throw new Error(
          persistData?.error ||
            "Your section check was processed but could not be saved. Please retry."
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Section check failed. Please try again from this section."
      );
    } finally {
      setCheckingSection(null);
    }
  };

  const setSourceDraftField = (
    sectionId: string,
    field: "title" | "author" | "publication" | "year" | "notes",
    value: string
  ) => {
    setSourceDrafts((prev) => ({
      ...prev,
      [sectionId]: {
        title: prev[sectionId]?.title || "",
        author: prev[sectionId]?.author || "",
        publication: prev[sectionId]?.publication || "",
        year: prev[sectionId]?.year || "",
        notes: prev[sectionId]?.notes || "",
        [field]: value,
      },
    }));
  };

  const addSourceToSection = async (sectionId: string) => {
    if (!savedOutlineId) {
      setError("Save your outline before adding sources.");
      return;
    }
    const draft = sourceDrafts[sectionId];
    if (!draft?.title?.trim()) {
      setError("Source title is required.");
      return;
    }
    const section = sections.find((item) => item.id === sectionId);
    if (!section) return;

    const source: SectionSource = {
      id: crypto.randomUUID(),
      title: draft.title.trim(),
      author: draft.author.trim() || null,
      publication: draft.publication.trim() || null,
      year: draft.year.trim() ? Number(draft.year.trim()) || null : null,
      notes: draft.notes.trim() || null,
      relevanceLevel: null,
      relevanceExplanation: null,
      sectionFit: null,
      gaps: null,
      suggestedUsage: null,
      evaluatedAt: null,
    };

    setEvaluatingSourceFor(sectionId);
    setError(null);

    try {
      const evaluateResponse = await fetch("/api/academic/paper/source-evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          sectionContent: section.mainPoints,
          sectionTitle: section.title || section.id,
          studentDeclaration: declaration,
          paperArgument: thesis,
        }),
      });
      const evaluateData = await evaluateResponse.json();
      if (!evaluateResponse.ok || !evaluateData?.evaluation) {
        throw new Error(evaluateData?.error || "Source evaluation failed.");
      }

      const now = new Date().toISOString();
      const nextSource: SectionSource = {
        ...source,
        relevanceLevel: evaluateData.evaluation.relevanceLevel,
        relevanceExplanation: evaluateData.evaluation.relevanceExplanation,
        sectionFit: evaluateData.evaluation.sectionFit || null,
        gaps: evaluateData.evaluation.gaps || null,
        suggestedUsage: evaluateData.evaluation.suggestedUsage || null,
        evaluatedAt: now,
      };

      const nextSections = sections.map((item) =>
        item.id === sectionId
          ? { ...item, sources: [...item.sources, nextSource] }
          : item
      );
      setSections(nextSections);

      await fetch(`/api/academic/outline/${savedOutlineId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          assignmentType,
          className,
          outline: {
            thesis,
            sections: nextSections.map((item) => ({
              id: item.id,
              title: item.title,
              main_points: item.mainPoints
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
              evidence: [],
              victor_confirmed: item.victorConfirmed,
              victor_confirmed_at: item.victorConfirmedAt,
              sources: item.sources,
            })),
            conclusion,
          },
          conversationHistory,
          studentDeclaration: declaration,
          sectionConfidence,
          sourceRequirements,
        }),
      });

      setSourceDrafts((prev) => ({
        ...prev,
        [sectionId]: { title: "", author: "", publication: "", year: "", notes: "" },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not evaluate source.");
    } finally {
      setEvaluatingSourceFor(null);
    }
  };

  const askVictorWhatToLookFor = async (sectionId: string) => {
    const section = sections.find((item) => item.id === sectionId);
    if (!section) return;
    const prompt = `For section \"${section.title || section.id}\", tell me what type of source I should look for, where to search, and search terms. Do not name specific titles or authors.`;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: prompt, timestamp: new Date().toISOString() },
    ]);
    try {
      const response = await fetch("/api/victor/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          conversationId: conversationId || undefined,
          mode: "study",
          workspaceContext: "Paper workflow · source guidance",
          coachingProfile,
          assignmentId: assignmentId || null,
          victorContext: {
            sectionTitle: section.title,
            sectionBody: section.mainPoints,
            assignmentRequirements: assignmentDetails?.requirements || null,
            assignmentName: assignmentDetails?.assignment_name || "Current assignment",
            className: assignmentDetails?.class_name || className,
            paperType: assignmentDetails?.assignment_type || assignmentType || null,
            studentDeclaration: declaration,
            unsureSections: Object.entries(sectionConfidence)
              .filter(([, value]) => value === "unsure")
              .map(([id]) => sections.find((item) => item.id === id)?.title || id),
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Victor source guidance failed.");
      }
      if (typeof data?.conversationId === "string") {
        setConversationId(data.conversationId);
      }
      const reply =
        typeof data?.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : "Use library databases and match sources to your section claim.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply, timestamp: new Date().toISOString() },
      ]);

      const nextHistory = [
        ...conversationHistory,
        {
          type: "source_guidance",
          section_id: sectionId,
          victor_response: reply,
          timestamp: new Date().toISOString(),
        },
      ];
      setConversationHistory(nextHistory);

      if (savedOutlineId) {
        const persistResponse = await fetch(`/api/academic/outline/${savedOutlineId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic,
            assignmentType,
            className,
            outline: buildOutlinePayload(),
            conversationHistory: nextHistory,
            studentDeclaration: declaration,
            sectionConfidence,
            sourceRequirements,
          }),
        });
        if (!persistResponse.ok) {
          const persistData = await persistResponse.json();
          throw new Error(
            persistData?.error ||
              "Source guidance was generated but could not be saved to your outline."
          );
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not get source guidance from Victor."
      );
    }
  };

  const removeSourceFromSection = async (sectionId: string, sourceId: string) => {
    if (!savedOutlineId) return;
    const nextSections = sections.map((section) =>
      section.id === sectionId
        ? {
            ...section,
            sources: section.sources.filter((source) => source.id !== sourceId),
          }
        : section
    );
    setSections(nextSections);
    try {
      const response = await fetch(`/api/academic/outline/${savedOutlineId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          assignmentType,
          className,
          outline: {
            thesis,
            sections: nextSections.map((item) => ({
              id: item.id,
              title: item.title,
              main_points: item.mainPoints
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
              evidence: [],
              victor_confirmed: item.victorConfirmed,
              victor_confirmed_at: item.victorConfirmedAt,
              sources: item.sources,
            })),
            conclusion,
          },
          conversationHistory,
          studentDeclaration: declaration,
          sectionConfidence,
          sourceRequirements,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Could not remove source from this section.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not remove source from this section."
      );
    }
  };

  const sourceCompletenessErrors = (): string[] => {
    if (!sourceRequirements?.sourcesRequired) return [];
    const errors: string[] = [];
    const allSources = sections.flatMap((section) => section.sources || []);
    const minCount = sourceRequirements.minimumCount;
    if (typeof minCount === "number" && allSources.length < minCount) {
      errors.push(`You need ${minCount} sources — you currently have ${allSources.length}.`);
    }

    sections.forEach((section, index) => {
      const hasClaim = section.mainPoints.trim().length > 0;
      if (hasClaim && (section.sources || []).length === 0) {
        errors.push(`Section ${section.title || index + 1} has no sources attached.`);
      }
    });

    const unrelatedCount = allSources.filter(
      (source) => source.relevanceLevel === "unrelated"
    ).length;
    if (unrelatedCount > 0) {
      errors.push(`${unrelatedCount} source(s) are flagged as unrelated.`);
    }

    return errors;
  };

  const continueToGeneration = async () => {
    if (!savedOutlineId) {
      setError("Save your outline before continuing.");
      return;
    }
    if (!allSectionsRated) {
      setError("Rate confidence for every section before continuing.");
      return;
    }
    const sourceErrors = sourceCompletenessErrors();
    if (sourceErrors.length > 0) {
      setError("Source check: resolve missing or weak sources before continuing.");
      return;
    }
    const unconfirmedSections = sections.filter((section) => !section.victorConfirmed);
    if (unconfirmedSections.length > 0) {
      setError(
        `Victor still needs confirmation on ${unconfirmedSections.length} section(s). Complete section checks before continuing.`
      );
      return;
    }

    try {
      await persistOutline(savedOutlineId, true);
      onContinue(savedOutlineId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Your outline could not be saved. Check your connection and try again."
      );
    }
  };

  const currentSourceErrors = sourceCompletenessErrors();
  const requirementsText = requirementsToPlainText(assignmentDetails?.requirements || null);
  const hasRequirements = requirementsText.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-semibold text-slate-100">Before you build your outline</p>
        <p className="mt-2 text-sm text-slate-400">
          Answer these in your own words. Victor will use them to guide your outline.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="block md:col-span-1">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Main argument
            </span>
            <textarea
              value={declaration.argument}
              onChange={(event) =>
                setDeclaration((prev) => ({ ...prev, argument: event.target.value }))
              }
              rows={4}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
            />
          </label>
          <label className="block md:col-span-1">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Main supporting ideas
            </span>
            <textarea
              value={declaration.main_points}
              onChange={(event) =>
                setDeclaration((prev) => ({ ...prev, main_points: event.target.value }))
              }
              rows={4}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
            />
          </label>
          <label className="block md:col-span-1">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Assignment understanding
            </span>
            <textarea
              value={declaration.assignment_understanding}
              onChange={(event) =>
                setDeclaration((prev) => ({
                  ...prev,
                  assignment_understanding: event.target.value,
                }))
              }
              rows={4}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-slate-500">Minimum 20 characters per response.</p>
          <button
            type="button"
            onClick={() => void submitDeclaration()}
            disabled={!declarationIsValid}
            className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-xs text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue to outline
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-slate-200">
        <span className="font-semibold text-sky-200">Step 1:</span> Work with Victor on the left to sharpen the claim and key points. <span className="font-semibold text-sky-200">Step 2:</span> Apply structure, then run section checks.
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-sky-300" />
            <p className="text-sm font-semibold text-slate-100">Step 1: Victor outline session</p>
          </div>
          {!declarationCompleted && (
            <AcademicEmptyState
              title="Declaration required"
              description="Complete the declaration above to unlock Victor-based outline extraction."
              className="mt-4 !min-h-0 py-3"
            />
          )}
          {declarationCompleted && (
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3">
                Victor: {latestVictorMessage?.content || "Waiting for Victor response."}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void applyVictorOutline()}
                  disabled={!latestVictorMessage}
                  className="rounded-full border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-xs text-sky-200 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Use Victor outline
                </button>
                {!latestVictorMessage && (
                  <span className="text-xs text-slate-500">Waiting for Victor response.</span>
                )}
                {latestVictorMessage && !latestAssistantOutlineMessage && (
                  <span className="text-xs text-amber-300">
                    Latest response does not look like a structured outline yet.
                  </span>
                )}
                {unlocked && (
                  <span className="text-xs text-emerald-300">Outline unlocked. Review and edit.</span>
                )}
              </div>
              {extractionResult &&
                (extractionResult.confidence === "low" ||
                  extractionResult.confidence === "failed") && (
                  <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
                    <p className="font-semibold">Recovery options</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void applyVictorOutline()}
                        className="rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1.5 text-[11px] text-amber-100"
                      >
                        Try again
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSections(buildAssignmentTemplate());
                          setUnlocked(true);
                          setError(null);
                          setInfo("Template loaded. Review and customize each section.");
                        }}
                        className="rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1.5 text-[11px] text-sky-100"
                      >
                        Start from assignment template
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSections(defaultSections());
                          setUnlocked(true);
                          setError(null);
                          setInfo("Manual mode enabled. Build your outline directly.");
                        }}
                        className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] text-slate-100"
                      >
                        Build my own outline
                      </button>
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-3">
            <FilePlus className="h-5 w-5 text-slate-200" />
            <p className="text-sm font-semibold text-slate-100">Step 2: Outline details</p>
          </div>
          {!unlocked && (
            <AcademicEmptyState
              title="Outline form locked"
              description="Waiting for declaration + Victor response to unlock the outline form."
              className="mt-4 !min-h-0 py-3"
            />
          )}
          {unlocked && (
            <div className="mt-4 space-y-4 text-sm text-slate-300">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Topic</span>
                <input
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="Enter your thesis or topic"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Class</span>
                <input
                  value={className}
                  onChange={(event) => setClassName(event.target.value)}
                  placeholder="Course or professor"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Assignment type</span>
                <input
                  value={assignmentType}
                  onChange={(event) => setAssignmentType(event.target.value)}
                  placeholder="Essay, research paper, lab report"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {unlocked && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-100">Assignment requirements</p>
            <button
              type="button"
              onClick={() => setRequirementsOpen((prev) => !prev)}
              className="text-xs text-slate-300"
            >
              {requirementsOpen ? "Hide" : "Show"}
            </button>
          </div>
          {requirementsOpen && (
            <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
              <p>
                {(assignmentDetails?.class_name || className || "Class not set")} · {" "}
                {(assignmentDetails?.assignment_type || assignmentType || "Type not set")}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Due: {assignmentDetails?.due_date || "Not set"} · Weight:{" "}
                {typeof assignmentDetails?.grading_weight === "number"
                  ? assignmentDetails.grading_weight
                  : "Not set"}
              </p>
              <div className="mt-3 text-xs text-slate-300">
                <p className="mb-1 font-semibold text-slate-200">Requirements</p>
                <pre className="whitespace-pre-wrap font-sans text-xs text-slate-300">
                  {hasRequirements ? requirementsText : "No specific requirements loaded."}
                </pre>
                {!hasRequirements && (
                  <a
                    href="/academic/assignments"
                    className="mt-2 inline-block text-[11px] text-sky-300 underline underline-offset-2"
                  >
                    Open assignment details
                  </a>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-300">
                <span className="font-semibold text-slate-200">Your stated argument:</span>{" "}
                {declaration.argument || "Not provided"}
              </p>
            </div>
          )}
        </div>
      )}

      {unlocked && sourceRequirements?.sourcesRequired && (
        <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          <p className="font-semibold">This paper requires sources</p>
          <p className="mt-1">
            Your assignment asks for{" "}
            {sourceRequirements.minimumCount ?? "an unspecified number of"} source(s) in{" "}
            {sourceRequirements.citationFormat || "the required citation format"}.
          </p>
          <p className="mt-1 text-xs text-amber-200">
            Add sources while building each section. Victor will help you find the right kind.
          </p>
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-semibold text-slate-100">Outline structure</p>
        <p className="mt-2 text-sm text-slate-400">
          Build each section, run understanding checks, then move to generation.
        </p>
        {!unlocked && (
          <AcademicEmptyState
            title="Outline structure locked"
            description="Waiting for declaration and Victor outline unlock."
            className="mt-4 !min-h-0 py-3"
          />
        )}
        {unlocked && (
          <>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Thesis</span>
                <textarea
                  value={thesis}
                  onChange={(event) => setThesis(event.target.value)}
                  rows={3}
                  placeholder="State the argument you will defend."
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Conclusion</span>
                <textarea
                  value={conclusion}
                  onChange={(event) => setConclusion(event.target.value)}
                  rows={3}
                  placeholder="Summarize the landing point."
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {sections.map((section, index) => (
                <div
                  key={section.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Section {index + 1}
                    </span>
                    {section.victorConfirmed ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300">
                        <Lock className="h-3 w-3" />
                        Victor confirmed
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">Needs check</span>
                    )}
                  </div>
                  <label className="mt-2 block">
                    <input
                      value={section.title}
                      onChange={(event) => {
                        const next = [...sections];
                        next[index] = {
                          ...next[index],
                          title: event.target.value,
                          victorConfirmed: false,
                          victorConfirmedAt: null,
                        };
                        setSections(next);
                        setUnderstandingOutcome((prev) => {
                          const { [section.id]: _removed, ...rest } = prev;
                          return rest;
                        });
                      }}
                      placeholder="Section title"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                    />
                  </label>
                  <label className="mt-3 block">
                    <textarea
                      value={section.mainPoints}
                      onChange={(event) => {
                        const next = [...sections];
                        next[index] = {
                          ...next[index],
                          mainPoints: event.target.value,
                          victorConfirmed: false,
                          victorConfirmedAt: null,
                        };
                        setSections(next);
                        setUnderstandingOutcome((prev) => {
                          const { [section.id]: _removed, ...rest } = prev;
                          return rest;
                        });
                      }}
                      rows={4}
                      placeholder="Key evidence, bullets, or logic."
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                    />
                  </label>

                  <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                      Before you lock this section
                    </p>
                    <textarea
                      value={understandingDraft[section.id] || ""}
                      onChange={(event) =>
                        setUnderstandingDraft((prev) => ({
                          ...prev,
                          [section.id]: event.target.value,
                        }))
                      }
                      rows={3}
                      placeholder="In one or two sentences, explain what this section is doing in your paper."
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void submitUnderstandingCheck(section.id)}
                        disabled={checkingSection === section.id || !savedOutlineId}
                        className="rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1 text-[11px] text-sky-200 disabled:opacity-60"
                      >
                        {checkingSection === section.id ? "Submitting..." : "Submit to Victor"}
                      </button>
                      {section.victorConfirmed && (
                        <button
                          type="button"
                          onClick={() => {
                            setSections((prev) =>
                              prev.map((item) =>
                                item.id === section.id
                                  ? {
                                      ...item,
                                      victorConfirmed: false,
                                      victorConfirmedAt: null,
                                    }
                                  : item
                              )
                            );
                            setUnderstandingOutcome((prev) => {
                              const { [section.id]: _removed, ...rest } = prev;
                              return rest;
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-slate-200"
                        >
                          <Unlock className="h-3 w-3" />
                          Unlock section
                        </button>
                      )}
                    </div>
                    {understandingFeedback[section.id] && (
                      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                        <p>{understandingFeedback[section.id]}</p>
                        {understandingOutcome[section.id] && (
                          <p
                            className={`mt-2 font-medium ${
                              understandingOutcome[section.id] === "confirmed"
                                ? "text-emerald-300"
                                : understandingOutcome[section.id] === "gap"
                                  ? "text-amber-300"
                                  : "text-red-300"
                            }`}
                          >
                            {understandingOutcome[section.id] === "confirmed"
                              ? "Outcome: confirmed"
                              : understandingOutcome[section.id] === "gap"
                                ? "Outcome: gap detected. Follow-up required."
                                : "Outcome: misalignment. Revision required."}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {sourceRequirements?.sourcesRequired && (
                    <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                        Sources for this section
                      </p>
                      <div className="grid gap-2">
                        <input
                          value={sourceDrafts[section.id]?.title || ""}
                          onChange={(event) =>
                            setSourceDraftField(section.id, "title", event.target.value)
                          }
                          placeholder="Title (required)"
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                        />
                        <input
                          value={sourceDrafts[section.id]?.author || ""}
                          onChange={(event) =>
                            setSourceDraftField(section.id, "author", event.target.value)
                          }
                          placeholder="Author"
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                        />
                        <input
                          value={sourceDrafts[section.id]?.publication || ""}
                          onChange={(event) =>
                            setSourceDraftField(
                              section.id,
                              "publication",
                              event.target.value
                            )
                          }
                          placeholder="Publication/journal"
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                        />
                        <input
                          value={sourceDrafts[section.id]?.year || ""}
                          onChange={(event) =>
                            setSourceDraftField(section.id, "year", event.target.value)
                          }
                          placeholder="Year"
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                        />
                        <input
                          value={sourceDrafts[section.id]?.notes || ""}
                          onChange={(event) =>
                            setSourceDraftField(section.id, "notes", event.target.value)
                          }
                          placeholder="Notes"
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void addSourceToSection(section.id)}
                          disabled={evaluatingSourceFor === section.id}
                          className="rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1 text-[11px] text-sky-200 disabled:opacity-60"
                        >
                          {evaluatingSourceFor === section.id
                            ? "Evaluating..."
                            : "Save source"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void askVictorWhatToLookFor(section.id)}
                          className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-slate-200"
                        >
                          Ask Victor what to look for
                        </button>
                      </div>

                      <div className="space-y-2">
                        {section.sources.map((source) => {
                          const level = source.relevanceLevel;
                          const borderClass =
                            level === "strong"
                              ? "border-emerald-400/40"
                              : level === "partial"
                                ? "border-amber-300/40"
                                : level === "weak"
                                  ? "border-orange-400/40"
                                  : level === "unrelated"
                                    ? "border-red-400/40"
                                    : "border-white/10";
                          return (
                            <div
                              key={source.id}
                              className={`rounded-xl border-l-2 ${borderClass} border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-medium text-slate-100">
                                  {source.title}
                                  {source.author ? ` — ${source.author}` : ""}
                                  {source.year ? ` (${source.year})` : ""}
                                </p>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void removeSourceFromSection(section.id, source.id)
                                  }
                                  className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300"
                                >
                                  Remove
                                </button>
                              </div>
                              {source.relevanceExplanation && (
                                <p className="mt-1 text-slate-300">
                                  Victor: {source.relevanceExplanation}
                                </p>
                              )}
                              {source.sectionFit && (
                                <p className="mt-1 text-slate-400">
                                  Section fit: {source.sectionFit}
                                </p>
                              )}
                              {source.gaps && (
                                <p className="mt-1 text-amber-300/90">Gap: {source.gaps}</p>
                              )}
                              {source.suggestedUsage && (
                                <p className="mt-1 text-slate-300">
                                  Suggested usage: {source.suggestedUsage}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {error && <AcademicErrorState message={error} className="mt-3 !min-h-0 py-3" />}
        {info && (
          <p className="mt-3 rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
            {info}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void saveOutline()}
            className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 px-5 py-2 text-sm text-sky-200 transition hover:border-sky-300/70 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saving || !unlocked}
          >
            {saving ? "Saving..." : "Save outline"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {savedOutlineId && unlocked && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm font-semibold text-slate-100">
            How clear are you on each section?
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Victor will pay extra attention to sections you mark as unsure.
          </p>
          <div className="mt-4 space-y-3">
            {sections.map((section, index) => {
              const sectionLabel = section.title.trim() || `Section ${index + 1}`;
              const selected = sectionConfidence[section.id];
              return (
                <div
                  key={`confidence-${section.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3"
                >
                  <p className="text-sm text-slate-200">{sectionLabel}</p>
                  <div className="flex flex-wrap gap-2">
                    {([
                      ["solid", "Solid"],
                      ["somewhat_clear", "Somewhat clear"],
                      ["unsure", "Unsure"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={`${section.id}-${value}`}
                        type="button"
                        onClick={() =>
                          setSectionConfidence((prev) => ({
                            ...prev,
                            [section.id]: value,
                          }))
                        }
                        className={`rounded-full border px-3 py-1 text-xs transition ${
                          selected === value
                            ? "border-sky-300/60 bg-sky-500/15 text-sky-200"
                            : "border-white/15 bg-white/5 text-slate-300"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {sourceRequirements?.sourcesRequired && currentSourceErrors.length > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <p className="font-semibold">Source check</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                {currentSourceErrors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-200">
                Resolve these before generating your paper.
              </p>
            </div>
          )}

          {sourceRequirements?.sourcesRequired && currentSourceErrors.length === 0 && (
            <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              Sources ready.{" "}
              {sections.flatMap((section) => section.sources || []).length} sources across{" "}
              {sections.filter((section) => (section.sources || []).length > 0).length} sections.
            </div>
          )}

          <button
            type="button"
            onClick={() => void continueToGeneration()}
            disabled={!allSectionsRated}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-5 py-2 text-sm text-emerald-200 transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue to generation
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
