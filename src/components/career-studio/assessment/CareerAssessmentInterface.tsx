// src/components/career-studio/assessment/CareerAssessmentInterface.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Target,
  Brain,
  Star,
  CloudLightning,
  CheckCircle2,
  Zap,
} from "lucide-react";

interface CareerAssessmentInterfaceProps {
  hasCompletedBefore?: boolean;
  lastCompletedDate?: string | Date;
  onViewResults?: () => void;
  variant?: "landing" | "progress";
  currentPhase?: number;
}

export default function CareerAssessmentInterface({
  hasCompletedBefore,
  lastCompletedDate,
  onViewResults,
  variant = "landing",
  currentPhase,
}: CareerAssessmentInterfaceProps) {
  const router = useRouter();
  const [isLoadingStatus, setIsLoadingStatus] = React.useState(true);
  const [latestAssessmentId, setLatestAssessmentId] = React.useState<string | null>(null);
  const [latestCompletedAt, setLatestCompletedAt] = React.useState<string | null>(null);

  const handleBegin = () => {
    router.push('/career-studio/dashboard?workspace=assessment');
  };

  React.useEffect(() => {
    let isActive = true;

    const loadAssessmentStatus = async () => {
      try {
        const response = await fetch("/api/career-assessment", { cache: "no-store" });
        const data = await response.json();
        if (!isActive) return;
        if (data?.success && data?.assessment?.id) {
          setLatestAssessmentId(data.assessment.id);
          setLatestCompletedAt(data.assessment.completedAt || null);
        }
      } catch {
        if (isActive) {
          setLatestAssessmentId(null);
          setLatestCompletedAt(null);
        }
      } finally {
        if (isActive) setIsLoadingStatus(false);
      }
    };

    loadAssessmentStatus();

    return () => {
      isActive = false;
    };
  }, []);

  const effectiveCompleted = Boolean(hasCompletedBefore || latestAssessmentId);
  const effectiveCompletedDate = latestCompletedAt || lastCompletedDate;

  const completedText = React.useMemo(() => {
    if (!effectiveCompleted || !effectiveCompletedDate) return null;
    try {
      const d =
        typeof effectiveCompletedDate === "string"
          ? new Date(effectiveCompletedDate)
          : effectiveCompletedDate;
      if (Number.isNaN(d.getTime())) return "Previously completed";
      return `Last completed: ${d.toLocaleDateString()}`;
    } catch {
      return "Previously completed";
    }
  }, [effectiveCompleted, effectiveCompletedDate]);

  if (variant === "progress") {
    const activePhase = currentPhase || 1;
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <section className="career-card rounded-3xl border border-white/10 bg-white/[0.03] p-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-base uppercase tracking-[0.22em] text-white/70">
                Career Assessment
              </h1>
              <p className="text-sm text-white/70">
                Lex is guiding the assessment on the left. Answer each phase to unlock your plan.
              </p>
            </div>
            <div className="rounded-full border border-white/20 bg-white/[0.04] px-3 py-1 text-[11px] text-white/60 uppercase tracking-[0.2em]">
              Phase {activePhase}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                Phases
              </div>
              <div className="space-y-3">
                {phases.map((phase, index) => (
                  <div
                    key={phase.id}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                      index + 1 < activePhase
                        ? 'border-emerald-300/30 bg-emerald-500/10'
                        : index + 1 === activePhase
                        ? 'border-white/20 bg-white/[0.05]'
                        : 'border-white/10 bg-white/[0.02]'
                    }`}
                  >
                    <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-white/[0.04] text-[11px] font-semibold text-white/70">
                      {index + 1 < activePhase ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : index + 1}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-white/90">
                        {phase.title}
                        {index + 1 === activePhase && (
                          <span className="ml-2 text-[10px] uppercase tracking-[0.2em] text-emerald-200/80">
                            Active
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-white/50 leading-relaxed">{phase.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                Completion
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-[11px] text-white/70 leading-relaxed">
                Generate plan unlocks after all required fields are covered:
                current role, energy drains/gains, compensation range, location, company stage,
                target title, ideal daily work, impact goal, and gaps.
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-[11px] text-white/60">
                Keep answering Lex’s prompts. The plan button activates when everything is complete.
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* MAIN CONTENT GRID */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* LEFT: HOW IT WORKS */}
        <section className="career-card relative space-y-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="pointer-events-none absolute inset-x-10 top-0 h-[2px] bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-60" />

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-[11px] text-white/70">
            Lex will keep asking until these are covered: current role, energy drains/gains,
            compensation range, location constraints, company stage, target title, ideal daily work,
            impact goal, and gaps. Don’t skip—empty fields become “Not specified.”
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">
                How The Assessment Works
              </h2>
              <p className="text-xs text-white/60">
                Lex guides you through 6 conversation phases designed to extract 
                what really matters for your career direction.
              </p>
            </div>
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/[0.04]">
              <CloudLightning className="h-5 w-5 text-emerald-300" />
              <span className="pointer-events-none absolute inset-0 rounded-full bg-emerald-300/25 blur-lg" />
            </div>
          </div>

          {/* Conversation Phases */}
          <div className="space-y-3">
            {phases.map((phase, index) => (
              <div
                key={phase.id}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-white/[0.04] text-[11px] font-semibold text-white/70">
                  {index + 1}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-white/90">{phase.title}</p>
                  <p className="text-[11px] text-white/50 leading-relaxed">{phase.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <BadgePill icon={Target} label="Direction" value="Recalibrating" />
            <BadgePill icon={Brain} label="Identity" value="Clarifying" />
            <BadgePill icon={Star} label="Standard" value="Elevating" />
          </div>
        </section>

        {/* RIGHT: WHAT YOU'LL GET */}
        <section className="career-card relative flex flex-col justify-between space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-90" />

          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/70">
                What You'll Get
              </h2>
              <p className="text-xs text-white/60">
                Lex turns the conversation into a clear plan and next steps.
              </p>
            </div>

            {/* Outcomes */}
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-4">
                <h3 className="text-xs font-semibold text-emerald-100 mb-2">
                  Your Career Profile
                </h3>
                <p className="text-[11px] text-white/60 leading-relaxed">
                  Current state, energy drains/gains, past patterns, non-negotiables 
                  (compensation, location, company stage), and your 18-month vision—documented 
                  and ready to inform every decision.
                </p>
              </div>

              <div className="rounded-xl border border-sky-300/20 bg-sky-500/10 p-4">
                <h3 className="text-xs font-semibold text-sky-100 mb-2">
                  Phased Action Plan
                </h3>
                <p className="text-[11px] text-white/60 leading-relaxed">
                  Concrete steps with real resources, realistic timelines, and actual costs. 
                  Not vague advice—specific certifications, courses, networking strategies, 
                  and skill development paths.
                </p>
              </div>

              <div className="rounded-xl border border-purple-300/20 bg-purple-500/10 p-4">
                <h3 className="text-xs font-semibold text-purple-100 mb-2">
                  Ongoing Accountability
                </h3>
                <p className="text-[11px] text-white/60 leading-relaxed">
                  Lex checks if you're drifting from your goals, warns when jobs don't align 
                  with your vision, and keeps you honest about progress.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] text-white/60 leading-relaxed">
                <span className="font-semibold text-white/80">Time commitment:</span> 15-20 minutes. 
                You bring the truth; Lex turns it into strategy that powers your entire Career Studio.
              </p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-3">
            {effectiveCompleted && (onViewResults || latestAssessmentId) && (
              <button
                type="button"
                onClick={
                  onViewResults
                    ? onViewResults
                    : () =>
                        router.push(
                          `/career-studio/assessment/results?id=${latestAssessmentId}`
                        )
                }
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-xs font-medium text-white transition hover:bg-white/10"
              >
                View Current Assessment
                <ArrowRight className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handleBegin}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-300/70 bg-emerald-300 px-6 py-3 text-sm font-semibold uppercase tracking-[0.22em] text-white shadow-[0_0_40px_rgba(52,211,153,0.55)] transition hover:bg-emerald-200"
            >
              {effectiveCompleted ? "Retake Assessment" : "Begin Assessment"}
              <Zap className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>

      {/* BOTTOM INFO */}
      <div className="career-card rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h3 className="text-sm font-semibold text-white mb-3">
          Why This Matters for ThinkWrite
        </h3>
        {completedText && !isLoadingStatus && (
          <p className="text-[11px] text-white/50 mb-3">{completedText}</p>
        )}
        <p className="text-xs text-white/60 leading-relaxed mb-4">
          Everything in Career Studio—resume tailoring, job analysis, application tracking—works 
          better when it knows your real baseline. This conversation gives Lex the context to:
        </p>
        <ul className="grid md:grid-cols-2 gap-3 text-[11px] text-white/60">
          <li className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Tailor resumes toward roles that actually match your vision
          </li>
          <li className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Flag jobs that conflict with your non-negotiables
          </li>
          <li className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Suggest skill development that closes actual gaps
          </li>
          <li className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Keep you accountable to the standard you set for yourself
          </li>
        </ul>
      </div>
    </div>
  );
}

/* ================================
   CONVERSATION PHASES
================================ */

const phases = [
  {
    id: 1,
    title: "Current Reality Check",
    description: "What's your current role and energy level? What drains you vs. what brings out your best?"
  },
  {
    id: 2,
    title: "Past Patterns",
    description: "When were you at your best in your career? When were you at your worst? What made the difference?"
  },
  {
    id: 3,
    title: "Non-Negotiables",
    description: "Compensation floor, location requirements, company stage, work-life boundaries—what's actually non-negotiable?"
  },
  {
    id: 4,
    title: "18-Month Vision",
    description: "Describe a typical Tuesday 18 months from now. What's your title, company, daily work, and how you feel?"
  },
  {
    id: 5,
    title: "Market Reality",
    description: "What companies/roles match your vision? What job titles interest you? Whose career do you admire?"
  },
  {
    id: 6,
    title: "Gap Assessment",
    description: "What's the gap between your current resume and target role? What skills, experience, or positioning needs work?"
  },
];

/* ================================
   BADGE PILL
================================ */

interface BadgePillProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
}

function BadgePill({ icon: Icon, label, value }: BadgePillProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 py-1 text-[11px] text-white/80">
      <Icon className="h-3.5 w-3.5 text-white" />
      <span className="uppercase tracking-[0.18em] text-white/50">{label}</span>
      <span className="text-[11px] text-white">{value}</span>
    </div>
  );
}
