// src/components/career-studio/assessment/CareerAssessmentResults.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Target,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Calendar,
  DollarSign,
  MapPin,
  Briefcase,
} from "lucide-react";

interface CareerProfile {
  currentTitle?: string;
  currentCompany?: string;
  energyLevel?: number;
  primaryDrains: string[];
  primaryGains: string[];
  
  compensationMinimum?: number;
  compensationTarget?: number;
  locationType?: string;
  companyStage?: string;
  
  targetTitle?: string;
  targetCompanies: string[];
  dailyWorkDescription?: string;
  impactGoal?: string;
  
  skillGaps: Array<{ skill: string; priority: number }>;
  experienceGaps: string[];
  
  readinessScore?: number;
  primaryMotivation?: string;
  riskFactors: string[];
}

interface ActionPlan {
  totalMonths: number;
  hoursPerWeek: number;
  estimatedCost: number;
  phases: Array<{
    phaseNumber: number;
    title: string;
    duration: string;
    items: Array<{
      category: string;
      action: string;
      why: string;
      resources: Array<{
        name: string;
        url?: string;
        cost?: number;
        time?: string;
      }>;
    }>;
  }>;
}

interface CareerAssessmentResultsProps {
  profile?: CareerProfile;
  actionPlan?: ActionPlan;
  onBack?: () => void;
}

export default function CareerAssessmentResults({
  profile,
  actionPlan,
  onBack,
}: CareerAssessmentResultsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(!profile);

  useEffect(() => {
    if (!profile) {
      loadAssessment();
    }
  }, [profile]);

  const loadAssessment = async () => {
    try {
      const response = await fetch("/api/career-assessment");
      const data = await response.json();
      
      if (data.success) {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Failed to load assessment:", error);
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-3 text-white/60">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          Loading your career assessment...
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="rounded-2xl border border-white/10 bg-black/60 p-8 text-center">
          <AlertCircle className="h-12 w-12 text-white/40 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            No Assessment Found
          </h2>
          <p className="text-sm text-white/60 mb-6">
            Complete your career assessment to see your personalized profile and action plan.
          </p>
          <button
            onClick={() => router.push('/career-studio/lex?mode=career-assessment')}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-300 px-6 py-3 text-sm font-semibold text-white"
          >
            Start Assessment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* HEADER */}
      <header className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Assessment Complete
          </div>
          <h1 className="text-3xl font-semibold text-white">
            Your Career Baseline
          </h1>
          <p className="text-sm text-white/60">
            This profile powers your entire Career Studio—from resume tailoring to job targeting.
          </p>
        </div>

        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Assessment
          </button>
        )}
      </header>

      {/* CAREER PROFILE */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Target className="h-5 w-5 text-emerald-300" />
          Your Career Profile
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Current State */}
          <div className="rounded-xl border border-white/10 bg-black/60 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider">
              Current State
            </h3>

            {profile.currentTitle && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-white/40">Current Role</p>
                <p className="text-sm text-white">{profile.currentTitle}</p>
                {profile.currentCompany && (
                  <p className="text-xs text-white/60">{profile.currentCompany}</p>
                )}
              </div>
            )}

            {profile.energyLevel !== undefined && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-white/40">Energy Level</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-500 via-violet-500 to-emerald-500"
                      style={{ width: `${profile.energyLevel * 10}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-white">{profile.energyLevel}/10</span>
                </div>
              </div>
            )}

            {profile.primaryDrains.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-white/40">Energy Drains</p>
                <ul className="space-y-1">
                  {profile.primaryDrains.slice(0, 3).map((drain, i) => (
                    <li key={i} className="text-xs text-red-300 flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-red-300 flex-shrink-0" />
                      {drain}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {profile.primaryGains.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-white/40">Energy Gains</p>
                <ul className="space-y-1">
                  {profile.primaryGains.slice(0, 3).map((gain, i) => (
                    <li key={i} className="text-xs text-emerald-300 flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-emerald-300 flex-shrink-0" />
                      {gain}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Non-Negotiables */}
          <div className="rounded-xl border border-white/10 bg-black/60 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider">
              Non-Negotiables
            </h3>

            <div className="space-y-3">
              {profile.compensationMinimum && (
                <div className="flex items-center gap-3 text-sm">
                  <DollarSign className="h-4 w-4 text-emerald-300" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Compensation</p>
                    <p className="text-white">
                      ${profile.compensationMinimum.toLocaleString()}
                      {profile.compensationTarget && ` - $${profile.compensationTarget.toLocaleString()}`}
                    </p>
                  </div>
                </div>
              )}

              {profile.locationType && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-sky-300" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Location</p>
                    <p className="text-white capitalize">{profile.locationType.replace('-', ' ')}</p>
                  </div>
                </div>
              )}

              {profile.companyStage && (
                <div className="flex items-center gap-3 text-sm">
                  <Briefcase className="h-4 w-4 text-purple-300" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Company Stage</p>
                    <p className="text-white capitalize">{profile.companyStage}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 18-Month Vision */}
          <div className="rounded-xl border border-white/10 bg-black/60 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider">
              18-Month Vision
            </h3>

            {profile.targetTitle && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-white/40">Target Title</p>
                <p className="text-sm font-semibold text-emerald-300">{profile.targetTitle}</p>
              </div>
            )}

            {profile.targetCompanies.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-white/40">Target Companies</p>
                <div className="flex flex-wrap gap-2">
                  {profile.targetCompanies.map((company, i) => (
                    <span
                      key={i}
                      className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white"
                    >
                      {company}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profile.dailyWorkDescription && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-white/40">Daily Work</p>
                <p className="text-xs text-white/70 leading-relaxed">{profile.dailyWorkDescription}</p>
              </div>
            )}
          </div>

          {/* Gaps & Readiness */}
          <div className="rounded-xl border border-white/10 bg-black/60 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider">
              Gaps & Readiness
            </h3>

            {profile.readinessScore !== undefined && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-white/40">Readiness Score</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500"
                      style={{ width: `${profile.readinessScore}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-white">{profile.readinessScore}%</span>
                </div>
              </div>
            )}

            {profile.skillGaps.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-white/40">Key Skill Gaps</p>
                <ul className="space-y-1">
                  {profile.skillGaps.slice(0, 5).map((gap, i) => (
                    <li key={i} className="text-xs text-violet-300 flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-violet-300 flex-shrink-0" />
                      {gap.skill}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {profile.riskFactors.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-white/40">Risk Factors</p>
                <ul className="space-y-1">
                  {profile.riskFactors.slice(0, 3).map((risk, i) => (
                    <li key={i} className="text-xs text-orange-300 flex items-start gap-2">
                      <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ACTION PLAN */}
      {actionPlan && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-300" />
              Your Action Plan
            </h2>
            <div className="flex items-center gap-4 text-xs text-white/60">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {actionPlan.totalMonths} months
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                ~${actionPlan.estimatedCost.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {actionPlan.phases.map((phase) => (
              <div
                key={phase.phaseNumber}
                className="rounded-xl border border-white/10 bg-black/60 p-5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Phase {phase.phaseNumber}: {phase.title}
                    </h3>
                    <p className="text-xs text-white/60">{phase.duration}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {phase.items.map((item, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-white/10 bg-black/40 p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{item.action}</p>
                          <p className="text-xs text-white/60 mt-1">{item.why}</p>
                        </div>
                        <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
                          {item.category}
                        </span>
                      </div>

                      {item.resources.length > 0 && (
                        <div className="space-y-1 pt-2 border-t border-white/10">
                          <p className="text-[10px] uppercase tracking-wider text-white/40">Resources</p>
                          {item.resources.map((resource, j) => (
                            <div
                              key={j}
                              className="flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2">
                                {resource.url ? (
                                  <a
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sky-300 hover:text-sky-200 flex items-center gap-1"
                                  >
                                    {resource.name}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <span className="text-white/80">{resource.name}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-white/60">
                                {resource.cost && <span>${resource.cost}</span>}
                                {resource.time && <span>{resource.time}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* NEXT STEPS */}
      <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/5 p-6">
        <h3 className="text-sm font-semibold text-emerald-100 mb-3">
          Your Career Studio is Now Calibrated
        </h3>
        <p className="text-xs text-white/70 leading-relaxed mb-4">
          This assessment becomes the backbone for everything you do in Career Studio. When you tailor 
          resumes, analyze jobs, or track applications, ThinkWrite uses this baseline to keep you aligned 
          with your actual goals—not just any job.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/career-studio/tailor-resume')}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-300 px-5 py-2 text-xs font-semibold text-white"
          >
            Start Tailoring Resumes
          </button>
          <button
            onClick={() => router.push('/career-studio/job-analysis')}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2 text-xs text-white"
          >
            Analyze Jobs
          </button>
        </div>
      </div>
    </div>
  );
}
