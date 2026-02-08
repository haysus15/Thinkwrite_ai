// src/components/career-studio/resume-builder/ResumeBuilderInterface.tsx

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  User,
  Briefcase,
  GraduationCap,
  Code,
  Award,
  FolderOpen,
  ChevronLeft,
  Save,
  MessageCircle,
  Loader2,
  Target,
  Check,
  AlertCircle,
} from "lucide-react";

import type {
  ResumeBuilderData,
  SectionStatus,
  SectionFeedback,
} from "@/types/resume-builder";
import {
  createEmptyResume,
  canSaveResume,
  calculateCompletion,
} from "@/types/resume-builder";

import ContactSection from "./sections/ContactSection";
import SummarySection from "./sections/SummarySection";
import ExperienceSection from "./sections/ExperienceSection";
import EducationSection from "./sections/EducationSection";
import SkillsSection from "./sections/SkillsSection";
import ProjectsSection from "./sections/ProjectsSection";
import CertificationsSection from "./sections/CertificationsSection";
import LexFeedbackPanel from "./LexFeedbackPanel";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthRequiredUrl } from "@/lib/auth/redirects";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/* ============================================================
   TYPES & CONSTANTS
============================================================ */

type SectionKey =
  | "contact"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications";

interface ResumeBuilderInterfaceProps {
  resumeId?: string;
}

const SECTIONS: Array<{
  key: SectionKey;
  label: string;
  icon: React.ReactNode;
  required: boolean;
}> = [
  {
    key: "contact",
    label: "Contact Info",
    icon: <User className="w-4 h-4" />,
    required: true,
  },
  {
    key: "summary",
    label: "Summary",
    icon: <FileText className="w-4 h-4" />,
    required: false,
  },
  {
    key: "experience",
    label: "Experience",
    icon: <Briefcase className="w-4 h-4" />,
    required: true,
  },
  {
    key: "skills",
    label: "Skills",
    icon: <Code className="w-4 h-4" />,
    required: true,
  },
  {
    key: "education",
    label: "Education",
    icon: <GraduationCap className="w-4 h-4" />,
    required: true,
  },
  {
    key: "projects",
    label: "Projects",
    icon: <FolderOpen className="w-4 h-4" />,
    required: false,
  },
  {
    key: "certifications",
    label: "Certifications",
    icon: <Award className="w-4 h-4" />,
    required: false,
  },
];

/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function ResumeBuilderInterface({
  resumeId,
}: ResumeBuilderInterfaceProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [resume, setResume] = useState<ResumeBuilderData>(
    createEmptyResume(user?.id || "")
  );
  const [activeSection, setActiveSection] = useState<SectionKey>("contact");

  const [showOnboarding, setShowOnboarding] = useState(!resumeId);
  const supabase = createSupabaseBrowserClient();
  const [remoteOnboardingResolved, setRemoteOnboardingResolved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [currentFeedback, setCurrentFeedback] =
    useState<SectionFeedback | null>(null);
  const [isLexDockOpen, setIsLexDockOpen] = useState(true);
  const [rawImportedText, setRawImportedText] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(getAuthRequiredUrl(pathname));
      return;
    }

    if (resumeId) {
      loadResume(resumeId);
      setShowOnboarding(false);
    } else if (user?.id) {
      setResume(createEmptyResume(user.id));
    }
  }, [authLoading, user, resumeId]);

  useEffect(() => {
    if (!canSaveResume(resume)) return;

    const timer = setTimeout(() => {
      autoSave();
    }, 3000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume]);

  const loadResume = async (id: string) => {
    try {
      const response = await fetch(`/api/resume-builder/${id}`);
      const data = await response.json();
      if (data.success && data.resume) {
        setResume(data.resume);
        if (data.resume.rawImportedText) {
          setRawImportedText(data.resume.rawImportedText);
        } else {
          setRawImportedText(null);
        }
      }
    } catch (error) {
      console.error("Failed to load resume:", error);
    }
  };

  const autoSave = async () => {
    if (!canSaveResume(resume)) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const method = resume.id ? "PUT" : "POST";
      const url = resume.id
        ? `/api/resume-builder/${resume.id}`
        : "/api/resume-builder";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resume),
      });

      const data = await response.json();

      if (data.success) {
        if (!resume.id && data.resume?.id) {
          setResume((prev) => ({ ...prev, id: data.resume.id }));
        }
        setLastSaved(new Date());
      } else {
        setSaveError(data.error || "Failed to save");
      }
    } catch (error) {
      setSaveError("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSave = async () => {
    await autoSave();
  };

  const updateResume = useCallback((updates: Partial<ResumeBuilderData>) => {
    setResume((prev) => ({
      ...prev,
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const updateSectionStatus = useCallback(
    (section: SectionKey, status: SectionStatus) => {
      setResume((prev) => ({
        ...prev,
        sectionStatuses: {
          ...prev.sectionStatuses,
          [section]: status,
        },
      }));
    },
    []
  );

  const getSectionContent = (section: SectionKey) => {
    switch (section) {
      case "contact":
        return resume.contactInfo;
      case "summary":
        return resume.summary;
      case "experience":
        return resume.experience;
      case "education":
        return resume.education;
      case "skills":
        return resume.skills;
      case "projects":
        return resume.projects;
      case "certifications":
        return resume.certifications;
    }
  };

  const getLexFeedback = async () => {
    setIsLoadingFeedback(true);

    try {
      const sectionContent = getSectionContent(activeSection);

      const response = await fetch("/api/resume-builder/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: activeSection,
          content: sectionContent,
          targetRole: resume.targetRole,
          targetIndustry: resume.targetIndustry,
        }),
      });

      const data = await response.json();

      if (data.success && data.feedback) {
        setCurrentFeedback(data.feedback);
        setIsLexDockOpen(true);

        updateSectionStatus(activeSection, "reviewed");

        setResume((prev) => ({
          ...prev,
          sectionFeedback: {
            ...prev.sectionFeedback,
            [activeSection]: data.feedback,
          },
        }));
      }
    } catch (error) {
      console.error("Failed to get feedback:", error);
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  const handleOnboardingComplete = (
    targetRole: string,
    targetIndustry: string
  ) => {
    updateResume({ targetRole, targetIndustry });
    setShowOnboarding(false);
    if (user) {
      const now = new Date().toISOString();
      supabase
        .from("user_onboarding")
        .upsert({
          user_id: user.id,
          resume_builder_onboarding_completed_at: now,
          updated_at: now,
        })
        .then(() => {});
    }
  };

  const handleOnboardingSkip = () => {
    setShowOnboarding(false);
    if (user) {
      const now = new Date().toISOString();
      supabase
        .from("user_onboarding")
        .upsert({
          user_id: user.id,
          resume_builder_onboarding_skipped_at: now,
          updated_at: now,
        })
        .then(() => {});
    }
  };

  const completion = calculateCompletion(resume);

  const getSectionStatusCompletion = (status: SectionStatus): number => {
    switch (status) {
      case "empty":
        return 0;
      case "draft":
        return 40;
      case "reviewed":
        return 70;
      case "polished":
        return 100;
      default:
        return 0;
    }
  };

  const canRequestFeedback = hasSectionContent(activeSection, resume);

  useEffect(() => {
    if (!user || resumeId) {
      setRemoteOnboardingResolved(true);
      return;
    }
    let isMounted = true;

    supabase
      .from("user_onboarding")
      .select("resume_builder_onboarding_completed_at,resume_builder_onboarding_skipped_at")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!isMounted) return;
        const alreadyHandled =
          Boolean(data?.resume_builder_onboarding_completed_at) ||
          Boolean(data?.resume_builder_onboarding_skipped_at);
        if (alreadyHandled) {
          setShowOnboarding(false);
        }
        setRemoteOnboardingResolved(true);
      });

    return () => {
      isMounted = false;
    };
  }, [user?.id, resumeId, supabase]);

  /* ============================================================
     APPLY REWRITE HANDLER
  ============================================================ */

  const handleApplyRewrite = (original: string, suggested: string) => {
    if (!original || !suggested || original === suggested) return;

    setResume((prev) => {
      const updated = applyRewriteToSection(
        activeSection,
        original,
        suggested,
        prev
      );
      return {
        ...updated,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  /* ============================================================
     ONBOARDING MODAL
  ============================================================ */

  if (showOnboarding) {
    if (!remoteOnboardingResolved) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-sm text-white/80 shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking onboarding…
          </div>
        </div>
      );
    }

    return (
      <OnboardingModal
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />
    );
  }

  /* ============================================================
     MAIN RENDER (SHELL)
  ============================================================ */

  return (
    <Shell>
      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1.8fr)] gap-6">
        {/* LEFT: meta + sections */}
        <section className="space-y-4">
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 text-xs">
            <button
              onClick={() =>
                router.push("/career-studio/resume-manager")
              }
              className="flex items-center gap-2 text-white/60 hover:text-white mb-3"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="text-[11px]">Back to Resume Manager</span>
            </button>

            <label className="block text-[11px] text-white/50 mb-1">
              Resume title
            </label>
            <input
              type="text"
              value={resume.title ?? ""}
              onChange={(e) => updateResume({ title: e.target.value })}
              placeholder="e.g., Product Manager – Tech"
              className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-[#9333EA]/80"
            />

            {resume.targetRole && (
              <div className="mt-3 flex items-center gap-2 text-[11px] text-white/65">
                <Target className="w-4 h-4 text-[#9333EA]" />
                <span>{resume.targetRole}</span>
                {resume.targetIndustry && (
                  <span className="text-white/40">
                    · {resume.targetIndustry}
                  </span>
                )}
              </div>
            )}

            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-white/60">Completion</span>
                <span className="text-white font-medium">
                  {Math.round(completion)}%
                </span>
              </div>
              <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#9333EA] to-[#A855F7] transition-all duration-500"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 text-[11px]">
              {isSaving ? (
                <span className="text-white/60 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving…
                </span>
              ) : lastSaved ? (
                <span className="text-white/55 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Saved at {lastSaved.toLocaleTimeString()}
                </span>
              ) : (
                <span className="text-white/40">Not saved yet</span>
              )}

              <button
                onClick={handleManualSave}
                disabled={isSaving || !canSaveResume(resume)}
                className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 disabled:opacity-40 flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span className="text-[10px]">Save</span>
              </button>
            </div>

            {saveError && (
              <p className="mt-2 text-[10px] text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {saveError}
              </p>
            )}
          </div>

          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-3 text-xs max-h-[520px] overflow-y-auto">
            <p className="text-[11px] text-white/50 mb-2 px-1">Sections</p>
            <div className="space-y-1.5">
              {SECTIONS.map((section, idx) => {
                const status = resume.sectionStatuses[section.key];
                const isActive = activeSection === section.key;
                const statusCompletion =
                  getSectionStatusCompletion(status);

                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => setActiveSection(section.key)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border flex flex-col gap-1 transition-all ${
                      isActive
                        ? "bg-[#9333EA]/12 border-[#9333EA]/40 text-white"
                        : "bg-black/30 border-white/[0.08] text-white/70 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={
                            isActive
                              ? "text-[#9333EA]"
                              : "text-white/40"
                          }
                        >
                          {section.icon}
                        </span>
                        <span className="text-[11px] truncate">
                          {idx + 1 < 10 ? `0${idx + 1}` : idx + 1} ·{" "}
                          {section.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {section.required &&
                          status === "empty" && (
                            <span className="text-[10px] text-red-400">
                              *
                            </span>
                          )}
                        {getStatusIcon(status)}
                      </div>
                    </div>

                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          status === "polished"
                            ? "bg-emerald-400"
                            : "bg-[#9333EA]"
                        }`}
                        style={{ width: `${statusCompletion}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* CENTER: builder canvas + Lex dock */}
        <section className="space-y-4 min-w-0">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] text-white/45 mb-0.5">
                Track{" "}
                {SECTIONS.findIndex((s) => s.key === activeSection) + 1}
              </p>
              <h2 className="text-sm md:text-base font-semibold text-white flex items-center gap-2">
                {
                  SECTIONS.find((s) => s.key === activeSection)?.icon
                }
                {
                  SECTIONS.find((s) => s.key === activeSection)?.label
                }
              </h2>
              <p className="text-[11px] text-white/55 mt-0.5">
                {getSectionDescription(activeSection)}
              </p>
            </div>

            <button
              type="button"
              onClick={getLexFeedback}
              disabled={isLoadingFeedback || !canRequestFeedback}
              className={`px-4 py-2 rounded-xl text-[11px] font-medium flex items-center gap-2 transition-all ${
                canRequestFeedback
                  ? "bg-[#9333EA] text-white hover:bg-[#A855F7]"
                  : "bg-white/8 text-white/35 cursor-not-allowed"
              }`}
            >
              {isLoadingFeedback ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Getting notes…
                </>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4" />
                  Get notes from Lex
                </>
              )}
            </button>
          </div>

          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 md:p-5">
            <div className="max-w-3xl">
              {activeSection === "contact" && (
                <ContactSection
                  data={resume.contactInfo}
                  onChange={(contactInfo) => {
                    updateResume({ contactInfo });
                    if (contactInfo.name || contactInfo.email) {
                      updateSectionStatus("contact", "draft");
                    }
                  }}
                />
              )}

              {activeSection === "summary" && (
                <SummarySection
                  data={resume.summary}
                  targetRole={resume.targetRole}
                  onChange={(summary) => {
                    updateResume({ summary });
                    if (summary.length > 0) {
                      updateSectionStatus("summary", "draft");
                    }
                  }}
                />
              )}

              {activeSection === "experience" && (
                <ExperienceSection
                  data={resume.experience}
                  onChange={(experience) => {
                    updateResume({ experience });
                    if (experience.length > 0) {
                      updateSectionStatus("experience", "draft");
                    }
                  }}
                />
              )}

              {activeSection === "education" && (
                <EducationSection
                  data={resume.education}
                  onChange={(education) => {
                    updateResume({ education });
                    if (education.length > 0) {
                      updateSectionStatus("education", "draft");
                    }
                  }}
                />
              )}

              {activeSection === "skills" && (
                <SkillsSection
                  data={resume.skills}
                  targetRole={resume.targetRole}
                  onChange={(skills) => {
                    updateResume({ skills });
                    if (skills.length > 0) {
                      updateSectionStatus("skills", "draft");
                    }
                  }}
                />
              )}

              {activeSection === "projects" && (
                <ProjectsSection
                  data={resume.projects}
                  onChange={(projects) => {
                    updateResume({ projects });
                    if (projects.length > 0) {
                      updateSectionStatus("projects", "draft");
                    }
                  }}
                />
              )}

              {activeSection === "certifications" && (
                <CertificationsSection
                  data={resume.certifications}
                  onChange={(certifications) => {
                    updateResume({ certifications });
                    if (certifications.length > 0) {
                      updateSectionStatus("certifications", "draft");
                    }
                  }}
                />
              )}
            </div>
          </div>

          {(currentFeedback || isLoadingFeedback) && (
            <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#9333EA] to-violet-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                    L
                  </div>
                  <div>
                    <p className="text-xs text-white font-semibold">
                      Lex Studio Notes
                    </p>
                    <p className="text-[10px] text-white/45">
                      Feedback on your {getSectionLabel(activeSection)}{" "}
                      section.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setIsLexDockOpen((open) => !open)
                  }
                  className="text-white/50 hover:text-white/80 text-xs px-2 py-1 rounded-lg hover:bg-white/10"
                >
                  {isLexDockOpen ? "Collapse" : "Expand"}
                </button>
              </div>

              {isLexDockOpen && (
                <div className="max-h-[260px] overflow-y-auto p-3">
                  {isLoadingFeedback && (
                    <div className="flex items-center gap-2 text-xs text-white/70">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Lex is reading this section…</span>
                    </div>
                  )}

                  {currentFeedback && (
                    <LexFeedbackPanel
                      feedback={currentFeedback}
                      section={activeSection}
                      onClose={() => {
                        setIsLexDockOpen(false);
                      }}
                      onApplyRewrite={handleApplyRewrite}
                      onMarkPolished={() => {
                        updateSectionStatus(activeSection, "polished");
                        setIsLexDockOpen(false);
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}

/* ============================================================
   ONBOARDING MODAL
============================================================ */

function OnboardingModal({
  onComplete,
  onSkip,
}: {
  onComplete: (role: string, industry: string) => void;
  onSkip: () => void;
}) {
  const [targetRole, setTargetRole] = useState("");
  const [targetIndustry, setTargetIndustry] = useState("");

  const commonRoles = [
    "Software Engineer",
    "Data Analyst",
    "Product Manager",
    "Marketing Manager",
    "Sales Representative",
    "Project Manager",
    "Business Analyst",
    "UX Designer",
    "Financial Analyst",
    "Operations Manager",
  ];

  const industries = [
    "Technology",
    "Healthcare",
    "Finance",
    "Marketing",
    "Education",
    "Retail",
    "Manufacturing",
    "Consulting",
    "Non-profit",
    "Government",
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-lg w-full p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-[#9333EA]/20 flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-[#9333EA]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Let&apos;s Build Your Resume
          </h2>
          <p className="text-white/60">
            Tell me what you&apos;re targeting so I can give you
            relevant feedback as you write.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              What role are you targeting?
            </label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g., Data Analyst, Software Engineer..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-[#9333EA]"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {commonRoles.slice(0, 5).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setTargetRole(role)}
                  className={`px-3 py-1 rounded-full text-xs transition-all ${
                    targetRole === role
                      ? "bg-[#9333EA] text-white"
                      : "bg-white/10 text-white/60 hover:bg-white/20"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              What industry? (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {industries.map((industry) => (
                <button
                  key={industry}
                  type="button"
                  onClick={() =>
                    setTargetIndustry(
                      targetIndustry === industry ? "" : industry
                    )
                  }
                  className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                    targetIndustry === industry
                      ? "bg-[#9333EA] text-white"
                      : "bg-white/10 text-white/60 hover:bg-white/20"
                  }`}
                >
                  {industry}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-4 mt-8">
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
          >
            Skip for Now
          </button>
          <button
            type="button"
            onClick={() => onComplete(targetRole, targetIndustry)}
            className="flex-1 px-6 py-3 bg-[#9333EA] text-white rounded-lg hover:bg-[#A855F7] font-medium transition-colors"
          >
            Let&apos;s Go!
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   HELPERS
============================================================ */

function getSectionDescription(section: SectionKey): string {
  switch (section) {
    case "contact":
      return "Your professional contact information at the top of the page.";
    case "summary":
      return "A brief, sharp overview of who you are and what you bring to the role.";
    case "experience":
      return "Your work history, with bullet points that show impact and metrics.";
    case "education":
      return "Your academic background and training.";
    case "skills":
      return "Technical, domain, and soft skills that match your target role.";
    case "projects":
      return "Projects that prove you can do the work, even outside formal jobs.";
    case "certifications":
      return "Credentials and certifications that build extra credibility.";
  }
}

function getSectionLabel(section: SectionKey): string {
  return SECTIONS.find((s) => s.key === section)?.label ?? "this";
}

function getStatusIcon(status: SectionStatus) {
  switch (status) {
    case "empty":
      return null;
    case "draft":
      return <div className="w-2 h-2 rounded-full bg-violet-400" />;
    case "reviewed":
      return <div className="w-2 h-2 rounded-full bg-blue-400" />;
    case "polished":
      return <Check className="w-3 h-3 text-emerald-400" />;
  }
}

function hasSectionContent(
  section: SectionKey,
  resume: ResumeBuilderData
): boolean {
  switch (section) {
    case "contact":
      return !!(resume.contactInfo.name || resume.contactInfo.email);
    case "summary":
      return resume.summary.length > 10;
    case "experience":
      return resume.experience.length > 0;
    case "education":
      return resume.education.length > 0;
    case "skills":
      return (
        resume.skills.length > 0 &&
        resume.skills.some((g) => g.skills.length > 0)
      );
    case "projects":
      return resume.projects.length > 0;
    case "certifications":
      return resume.certifications.length > 0;
  }
}

/**
 * Deep replace helper: recursively copies an object/array and replaces
 * any string / string[] occurrences of `original` with `suggested`.
 */
function deepReplaceStrings(
  value: any,
  original: string,
  suggested: string
): any {
  if (typeof value === "string") {
    return value.includes(original)
      ? value.replaceAll(original, suggested)
      : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === "string"
        ? deepReplaceStrings(item, original, suggested)
        : deepReplaceStrings(item, original, suggested)
    );
  }

  if (value && typeof value === "object") {
    const next: any = Array.isArray(value) ? [] : {};
    Object.keys(value).forEach((key) => {
      next[key] = deepReplaceStrings(value[key], original, suggested);
    });
    return next;
  }

  return value;
}

/**
 * Apply rewrite to the current section inside the resume.
 * This is intentionally generic so it works with your existing
 * Experience / Projects / etc shapes without needing to know
 * all the exact field names.
 */
function applyRewriteToSection(
  section: SectionKey,
  original: string,
  suggested: string,
  resume: ResumeBuilderData
): ResumeBuilderData {
  switch (section) {
    case "summary":
      return {
        ...resume,
        summary: deepReplaceStrings(
          resume.summary,
          original,
          suggested
        ),
      };
    case "contact":
      return {
        ...resume,
        contactInfo: deepReplaceStrings(
          resume.contactInfo,
          original,
          suggested
        ),
      };
    case "experience":
      return {
        ...resume,
        experience: deepReplaceStrings(
          resume.experience,
          original,
          suggested
        ),
      };
    case "education":
      return {
        ...resume,
        education: deepReplaceStrings(
          resume.education,
          original,
          suggested
        ),
      };
    case "skills":
      return {
        ...resume,
        skills: deepReplaceStrings(
          resume.skills,
          original,
          suggested
        ),
      };
    case "projects":
      return {
        ...resume,
        projects: deepReplaceStrings(
          resume.projects,
          original,
          suggested
        ),
      };
    case "certifications":
      return {
        ...resume,
        certifications: deepReplaceStrings(
          resume.certifications,
          original,
          suggested
        ),
      };
  }
}

/* ============================================================
   SHARED SHELL (matches dashboard / resume manager)
============================================================ */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full text-white">
      <div className="max-w-7xl mx-auto px-6 py-6">{children}</div>
    </div>
  );
}
