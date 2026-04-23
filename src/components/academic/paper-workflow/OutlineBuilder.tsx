/**
 * @deprecated
 * OutlineBuilder is superseded by VictorOutlineWorkspace.
 * PaperWorkflowContainer now renders VictorOutlineWorkspace at the outline step.
 * This file is retained for reference and rollback safety.
 * Do not extend or modify this component.
 * Scheduled for removal after VictorOutlineWorkspace is runtime-validated.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, FilePlus, Lock, MessageSquare, Unlock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import BridgeModeIndicator from "@/components/shared/BridgeModeIndicator";
import { useBridgeMode } from "@/lib/bridge/useBridgeMode";
import {
  createBridgeSession,
  runBridgeTransfer,
  shouldRunBridgeTransfer,
} from "@/lib/bridge/client";
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
  const t = useTranslations("academic.paperWorkflow.outline");
  const { profile } = useAuth();
  const bridgeMode = useBridgeMode();
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
  const [bridgeTransferring, setBridgeTransferring] = useState(false);
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
        setError(t("errors.loadRequirements"));
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
        setError(t("errors.loadSavedOutline"));
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

    const nextTopic = getLine(["T", "opic"].join(""));
    const nextThesis = getLine(["T", "hesis"].join(""));
    const nextConclusion = getLine(["C", "onclusion"].join(""));
    const nextClass = getLine(["C", "lass"].join(""));
    const nextAssignmentType = getLine(["A", "ssignment type"].join(""));
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
      headers: { "content-type": "application/json" },
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
          title: t("templates.research.introductionTitle"),
          mainPoints: t("templates.research.introductionPoints"),
          victorConfirmed: false,
          victorConfirmedAt: null,
          sources: [],
        },
        {
          id: "section_2",
          title: t("templates.research.evidenceTitle"),
          mainPoints: t("templates.research.evidencePoints"),
          victorConfirmed: false,
          victorConfirmedAt: null,
          sources: [],
        },
        {
          id: "section_3",
          title: t("templates.research.conclusionTitle"),
          mainPoints: t("templates.research.conclusionPoints"),
          victorConfirmed: false,
          victorConfirmedAt: null,
          sources: [],
        },
      ];
    }
    return [
      {
        id: "section_1",
        title: t("templates.standard.introductionTitle"),
        mainPoints: t("templates.standard.introductionPoints"),
        victorConfirmed: false,
        victorConfirmedAt: null,
        sources: [],
      },
      {
        id: "section_2",
        title: t("templates.standard.bodyTitle"),
        mainPoints: t("templates.standard.bodyPoints"),
        victorConfirmed: false,
        victorConfirmedAt: null,
        sources: [],
      },
      {
        id: "section_3",
        title: t("templates.standard.conclusionTitle"),
        mainPoints: t("templates.standard.conclusionPoints"),
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
      setError(t("errors.victorOutlineParse"));
      return;
    }

    if (extracted.confidence === "low") {
      setUnlocked(false);
      setInfo(t("notices.partialOutlineRecovery"));
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
      setInfo(t("notices.sectionsNeedReview"));
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
      setInfo(t("notices.manualRecovery"));
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
      headers: { "content-type": "application/json" },
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
      throw new Error(data?.error || t("errors.saveOutline"));
    }
    if (!response.ok && patchOnly) {
      throw new Error(data?.error || t("errors.updateOutline"));
    }
  };

  const saveOutline = async () => {
    if (!topic.trim() || !thesis.trim()) {
      setError(t("errors.addTopicAndThesis"));
      return;
    }
    if (!declarationCompleted) {
      setError(t("errors.completeDeclarationBeforeSaving"));
      return;
    }

    setError(null);
    setSaving(true);
    try {
      if (savedOutlineId) {
        await persistOutline(savedOutlineId);
        onOutlineSaved?.();
        setInfo(t("notices.outlineUpdated"));
      } else {
        const response = await fetch("/api/academic/outline/create", {
          method: "POST",
          headers: { "content-type": "application/json" },
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
          throw new Error(data?.error || t("errors.saveOutline"));
        }
        setSavedOutlineId(data.outlineId);
        onOutlineSaved?.();
        setInfo(t("notices.outlineSaved"));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("errors.saveOutlineFallback")
      );
    } finally {
      setSaving(false);
    }
  };

  const submitDeclaration = async () => {
    if (!declarationIsValid) {
      setError(t("errors.declarationLength"));
      return;
    }
    setError(null);
    setDeclarationCompleted(true);
    setUnlocked(true);

    try {
      const sourceResponse = await fetch("/api/academic/paper/source-requirements", {
        method: "POST",
        headers: { "content-type": "application/json" },
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
      setError(t("errors.detectSourceRequirements"));
    }

    if (!savedOutlineId) {
      try {
        const draftResponse = await fetch("/api/academic/outline/create", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            topic: topic.trim() || declaration.argument.trim().slice(0, 160) || t("draftTopic"),
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
              t("errors.declarationDraftCreate")
          );
        }
        setSavedOutlineId(draftData.outlineId);
        onOutlineSaved?.();
        setInfo(t("notices.declarationSavedContinue"));
      } catch (err) {
        setInfo(
          err instanceof Error
            ? err.message
            : t("notices.declarationCaptured")
        );
      }
      return;
    }

    try {
      await persistOutline(savedOutlineId, true);
      setInfo(t("notices.declarationSaved"));
    } catch {
      setError(t("errors.declarationPersist"));
    }
  };

  const allSectionsRated = sections.every((section) => Boolean(sectionConfidence[section.id]));

  const submitUnderstandingCheck = async (sectionId: string) => {
    const explanation = (understandingDraft[sectionId] || "").trim();
    if (explanation.length < 30) {
      setError(t("errors.sectionExplanationLength"));
      return;
    }
    if (!savedOutlineId) {
      setError(t("errors.saveBeforeSectionChecks"));
      return;
    }

    const section = sections.find((item) => item.id === sectionId);
    if (!section) return;

    setCheckingSection(sectionId);
    setError(null);

    try {
      let workingExplanation = explanation;
      let bridgeEnglishOutput: string | null = null;
      let bridgeProfileVersion: 1 | 2 | null = null;

      if (bridgeMode.isActive && bridgeMode.sourceLanguage) {
        const shouldTransfer = await shouldRunBridgeTransfer(
          explanation,
          bridgeMode.sourceLanguage,
          0.7
        );
        if (shouldTransfer) {
          setBridgeTransferring(true);
          try {
            const transfer = await runBridgeTransfer(explanation);
            workingExplanation = transfer.workingText;
            bridgeEnglishOutput = transfer.englishOutput;
            bridgeProfileVersion = transfer.profileVersion;
            if (bridgeEnglishOutput && bridgeProfileVersion) {
              await createBridgeSession({
                studio: "academic",
                sourceLanguage: bridgeMode.sourceLanguage,
                sourceInput: explanation,
                englishOutput: bridgeEnglishOutput,
                profileVersion: bridgeProfileVersion,
              });
            }
          } finally {
            setBridgeTransferring(false);
          }
        }
      }

      const prompt = `Section understanding check:\nSection: ${section.title || section.id}\nMy explanation: ${workingExplanation}`;
      setMessages((prev) => [
        ...prev,
        { role: "user", content: prompt, timestamp: new Date().toISOString() },
      ]);

      const response = await fetch("/api/victor/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          conversationId: conversationId || undefined,
          mode: "study",
          outputLanguage: profile?.preferred_language || "en",
          workspaceContext: t("workspaceContext.sectionCheck"),
          coachingProfile,
          assignmentId: assignmentId || null,
          victorContext: {
            sectionTitle: section.title,
            sectionBody: section.mainPoints,
            assignmentRequirements: assignmentDetails?.requirements || null,
            assignmentName: assignmentDetails?.assignment_name || t("currentAssignment"),
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
        throw new Error(data?.error || t("errors.sectionCheck"));
      }
      if (typeof data?.conversationId === "string") {
        setConversationId(data.conversationId);
      }

      const victorReply =
        typeof data?.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : t("victorFallbacks.needMoreDetail");
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
            ? t("notices.sectionGap")
            : t("notices.sectionMisalignment")
        );
      }

      const persistResponse = await fetch(`/api/academic/outline/${savedOutlineId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
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
            t("errors.sectionCheckPersist")
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("errors.sectionCheckRetry")
      );
    } finally {
      setCheckingSection(null);
      setBridgeTransferring(false);
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
      setError(t("errors.saveBeforeSources"));
      return;
    }
    const draft = sourceDrafts[sectionId];
    if (!draft?.title?.trim()) {
      setError(t("errors.sourceTitleRequired"));
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
        headers: { "content-type": "application/json" },
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
        throw new Error(evaluateData?.error || t("errors.sourceEvaluation"));
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
        headers: { "content-type": "application/json" },
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
      setError(err instanceof Error ? err.message : t("errors.sourceEvaluateFallback"));
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
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          conversationId: conversationId || undefined,
          mode: "study",
          outputLanguage: profile?.preferred_language || "en",
          workspaceContext: t("workspaceContext.sourceGuidance"),
          coachingProfile,
          assignmentId: assignmentId || null,
          victorContext: {
            sectionTitle: section.title,
            sectionBody: section.mainPoints,
            assignmentRequirements: assignmentDetails?.requirements || null,
            assignmentName: assignmentDetails?.assignment_name || t("currentAssignment"),
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
        throw new Error(data?.error || t("errors.sourceGuidance"));
      }
      if (typeof data?.conversationId === "string") {
        setConversationId(data.conversationId);
      }
      const reply =
        typeof data?.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : t("victorFallbacks.sourceGuidance");
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
          headers: { "content-type": "application/json" },
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
              t("errors.sourceGuidancePersist")
          );
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("errors.sourceGuidanceFallback")
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
        headers: { "content-type": "application/json" },
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
        throw new Error(data?.error || t("errors.removeSource"));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("errors.removeSource")
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
      setError(t("errors.saveBeforeContinue"));
      return;
    }
    if (!allSectionsRated) {
      setError(t("errors.rateConfidence"));
      return;
    }
    const sourceErrors = sourceCompletenessErrors();
    if (sourceErrors.length > 0) {
      setError(t("errors.resolveSources"));
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
          : t("errors.saveOutlineFallback")
      );
    }
  };

  const currentSourceErrors = sourceCompletenessErrors();
  const requirementsText = requirementsToPlainText(assignmentDetails?.requirements || null);
  const hasRequirements = requirementsText.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-semibold text-slate-100">{t("beforeTitle")}</p>
        <p className="mt-2 text-sm text-slate-400">
          {t("beforeBody")}
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="block md:col-span-1">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {t("yourArgument")}
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
              {t("mainPoints")}
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
              {t("assignmentUnderstanding")}
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
          <p className="text-xs text-slate-500">{t("minimumResponse")}</p>
          <button
            type="button"
            onClick={() => void submitDeclaration()}
            disabled={!declarationIsValid}
            className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-xs text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("continueToOutline")}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-slate-200">
        {t("stepSummary")}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-sky-300" />
            <p className="text-sm font-semibold text-slate-100">{t("victorSessionTitle")}</p>
          </div>
          {!declarationCompleted && (
            <AcademicEmptyState
              title={t("emptyStates.declarationRequiredTitle")}
              description={t("emptyStates.declarationRequiredDescription")}
              className="mt-4 !min-h-0 py-3"
            />
          )}
          {declarationCompleted && (
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3">
                {t("victorPrefix")} {latestVictorMessage?.content || t("waitingForVictor")}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void applyVictorOutline()}
                  disabled={!latestVictorMessage}
                  className="rounded-full border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-xs text-sky-200 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t("useVictorOutline")}
                </button>
                {!latestVictorMessage && (
                  <span className="text-xs text-slate-500">{t("waitingForVictor")}</span>
                )}
                {latestVictorMessage && !latestAssistantOutlineMessage && (
                  <span className="text-xs text-amber-300">
                    {t("latestNotStructured")}
                  </span>
                )}
                {unlocked && (
                  <span className="text-xs text-emerald-300">{t("outlineUnlocked")}</span>
                )}
              </div>
              {extractionResult &&
                (extractionResult.confidence === "low" ||
                  extractionResult.confidence === "failed") && (
                  <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
                    <p className="font-semibold">{t("recoveryOptions")}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void applyVictorOutline()}
                        className="rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1.5 text-[11px] text-amber-100"
                      >
                        {t("tryAgain")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSections(buildAssignmentTemplate());
                          setUnlocked(true);
                          setError(null);
                          setInfo(t("notices.templateLoaded"));
                        }}
                        className="rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1.5 text-[11px] text-sky-100"
                      >
                        {t("startFromAssignmentTemplate")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSections(defaultSections());
                          setUnlocked(true);
                          setError(null);
                          setInfo(t("notices.manualModeEnabled"));
                        }}
                        className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] text-slate-100"
                      >
                        {t("buildOwnOutline")}
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
            <p className="text-sm font-semibold text-slate-100">{t("outlineDetailsTitle")}</p>
          </div>
          {!unlocked && (
            <AcademicEmptyState
              title={t("emptyStates.outlineFormLockedTitle")}
              description={t("emptyStates.outlineFormLockedDescription")}
              className="mt-4 !min-h-0 py-3"
            />
          )}
          {unlocked && (
            <div className="mt-4 space-y-4 text-sm text-slate-300">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("labels.topic")}</span>
                <input
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder={t("placeholders.topic")}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("labels.className")}</span>
                <input
                  value={className}
                  onChange={(event) => setClassName(event.target.value)}
                  placeholder={t("placeholders.className")}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("labels.assignmentType")}</span>
                <input
                  value={assignmentType}
                  onChange={(event) => setAssignmentType(event.target.value)}
                  placeholder={t("placeholders.assignmentType")}
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
            <p className="text-sm font-semibold text-slate-100">{t("assignmentRequirementsTitle")}</p>
            <button
              type="button"
              onClick={() => setRequirementsOpen((prev) => !prev)}
              className="text-xs text-slate-300"
            >
              {requirementsOpen ? t("hide") : t("show")}
            </button>
          </div>
          {requirementsOpen && (
            <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
              <p>
                {(assignmentDetails?.class_name || className || t("fallbacks.classNotSet"))} · {" "}
                {(assignmentDetails?.assignment_type || assignmentType || t("fallbacks.typeNotSet"))}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {t("dueWeight", {
                  due: assignmentDetails?.due_date || t("fallbacks.notSet"),
                  weight:
                    typeof assignmentDetails?.grading_weight === "number"
                      ? assignmentDetails.grading_weight
                      : t("fallbacks.notSet"),
                })}
              </p>
              <div className="mt-3 text-xs text-slate-300">
                <p className="mb-1 font-semibold text-slate-200">{t("requirements")}</p>
                <pre className="whitespace-pre-wrap font-sans text-xs text-slate-300">
                  {hasRequirements ? requirementsText : t("fallbacks.noRequirementsLoaded")}
                </pre>
                {!hasRequirements && (
                  <a
                    href="/academic/assignments"
                    className="mt-2 inline-block text-[11px] text-sky-300 underline underline-offset-2"
                  >
                    {t("openAssignmentDetails")}
                  </a>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-300">
                <span className="font-semibold text-slate-200">{t("yourStatedArgument")}</span>{" "}
                {declaration.argument || t("fallbacks.notProvided")}
              </p>
            </div>
          )}
        </div>
      )}

      {unlocked && sourceRequirements?.sourcesRequired && (
        <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          <p className="font-semibold">{t("sourcesRequiredTitle")}</p>
          <p className="mt-1">
            {t("sourcesRequiredBody", {
              count: sourceRequirements.minimumCount ?? t("fallbacks.unspecifiedSourceCount"),
              format: sourceRequirements.citationFormat || t("fallbacks.requiredCitationFormat"),
            })}
          </p>
          <p className="mt-1 text-xs text-amber-200">
            {t("sourcesRequiredHint")}
          </p>
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-semibold text-slate-100">{t("outlineStructureTitle")}</p>
        <p className="mt-2 text-sm text-slate-400">
          {t("outlineStructureBody")}
        </p>
        {!unlocked && (
          <AcademicEmptyState
            title={t("emptyStates.outlineStructureLockedTitle")}
            description={t("emptyStates.outlineStructureLockedDescription")}
            className="mt-4 !min-h-0 py-3"
          />
        )}
        {unlocked && (
          <>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("labels.thesis")}</span>
                <textarea
                  value={thesis}
                  onChange={(event) => setThesis(event.target.value)}
                  rows={3}
                  placeholder={t("placeholders.thesis")}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("labels.conclusion")}</span>
                <textarea
                  value={conclusion}
                  onChange={(event) => setConclusion(event.target.value)}
                  rows={3}
                  placeholder={t("placeholders.conclusion")}
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
                      {t("sectionNumber", { number: index + 1 })}
                    </span>
                    {section.victorConfirmed ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300">
                        <Lock className="h-3 w-3" />
                        {t("victorConfirmed")}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">{t("needsCheck")}</span>
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
                      placeholder={t("placeholders.sectionTitle")}
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
                      placeholder={t("placeholders.sectionLogic")}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                    />
                  </label>

                  <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                      {t("beforeLockSection")}
                    </p>
                    {bridgeMode.isActive && (
                      <BridgeModeIndicator
                        sourceLanguage={bridgeMode.sourceLanguage}
                        isTransferring={bridgeTransferring && checkingSection === section.id}
                      />
                    )}
                    <textarea
                      value={understandingDraft[section.id] || ""}
                      onChange={(event) =>
                        setUnderstandingDraft((prev) => ({
                          ...prev,
                          [section.id]: event.target.value,
                        }))
                      }
                      rows={3}
                      placeholder={t("placeholders.sectionExplanation")}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void submitUnderstandingCheck(section.id)}
                        disabled={checkingSection === section.id || !savedOutlineId}
                        className="rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1 text-[11px] text-sky-200 disabled:opacity-60"
                      >
                        {checkingSection === section.id ? t("submitting") : t("submitToVictor")}
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
                          {t("unlockSection")}
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
                              ? t("outcomes.confirmed")
                              : understandingOutcome[section.id] === "gap"
                                ? t("outcomes.gap")
                                : t("outcomes.misalignment")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {sourceRequirements?.sourcesRequired && (
                    <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                        {t("sourcesForSection")}
                      </p>
                      <div className="grid gap-2">
                        <input
                          value={sourceDrafts[section.id]?.title || ""}
                          onChange={(event) =>
                            setSourceDraftField(section.id, "title", event.target.value)
                          }
                          placeholder={t("placeholders.sourceTitle")}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                        />
                        <input
                          value={sourceDrafts[section.id]?.author || ""}
                          onChange={(event) =>
                            setSourceDraftField(section.id, "author", event.target.value)
                          }
                          placeholder={t("placeholders.author")}
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
                          placeholder={t("placeholders.publication")}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                        />
                        <input
                          value={sourceDrafts[section.id]?.year || ""}
                          onChange={(event) =>
                            setSourceDraftField(section.id, "year", event.target.value)
                          }
                          placeholder={t("placeholders.year")}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
                        />
                        <input
                          value={sourceDrafts[section.id]?.notes || ""}
                          onChange={(event) =>
                            setSourceDraftField(section.id, "notes", event.target.value)
                          }
                          placeholder={t("placeholders.notes")}
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
                            ? t("evaluating")
                            : t("saveSource")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void askVictorWhatToLookFor(section.id)}
                          className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-slate-200"
                        >
                          {t("askVictorWhatToLookFor")}
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
                                  {t("remove")}
                                </button>
                              </div>
                              {source.relevanceExplanation && (
                                <p className="mt-1 text-slate-300">
                                  {t("victorPrefix")} {source.relevanceExplanation}
                                </p>
                              )}
                              {source.sectionFit && (
                                <p className="mt-1 text-slate-400">
                                  {t("sectionFitPrefix")} {source.sectionFit}
                                </p>
                              )}
                              {source.gaps && (
                                <p className="mt-1 text-amber-300/90">{t("gapPrefix")} {source.gaps}</p>
                              )}
                              {source.suggestedUsage && (
                                <p className="mt-1 text-slate-300">
                                  {t("suggestedUsagePrefix")} {source.suggestedUsage}
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
            {saving ? t("saving") : t("saveOutline")}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {savedOutlineId && unlocked && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm font-semibold text-slate-100">
            {t("clarityTitle")}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            {t("clarityBody")}
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
                      ["solid", t("confidence.solid")],
                      ["somewhat_clear", t("confidence.somewhatClear")],
                      ["unsure", t("confidence.unsure")],
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
              <p className="font-semibold">{t("sourceCheckTitle")}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                {currentSourceErrors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-200">
                {t("sourceCheckBody")}
              </p>
            </div>
          )}

          {sourceRequirements?.sourcesRequired && currentSourceErrors.length === 0 && (
            <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {t("sourcesReadyPrefix")}{" "}
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
            {t("continueToGeneration")}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
