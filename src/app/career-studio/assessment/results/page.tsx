// src/app/career-studio/assessment/results/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface AssessmentResult {
  id: string;
  status: string;
  profile: any;
  actionPlan: any;
  completedAt?: string;
}

const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined) return "Not specified";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return String(value);
  }
};

const formatList = (items?: string[] | null) => {
  if (!items || items.length === 0) return "Not specified";
  return items.join(", ");
};

export default function CareerAssessmentResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assessmentId = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assessmentId) {
      setError("Assessment not found.");
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const res = await fetch(`/api/career-assessment/${assessmentId}`, { cache: "no-store" });
        const data = await res.json();
        if (!data?.success) {
          setError(data?.error || "Failed to load assessment.");
          return;
        }
        setResult({
          id: data.assessment.id,
          status: data.assessment.status,
          profile: data.assessment.profile,
          actionPlan: data.assessment.actionPlan,
          completedAt: data.assessment.completedAt
        });
      } catch (err) {
        setError("Failed to load assessment.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [assessmentId]);

  return (
    <div className="career-studio-root font-['Orbitron']">
      <div className="career-sky-layer">
        <div className="career-stars-layer" />
        <div className="career-nebula-layer" />
        <div className="career-milky-way" />
        <div className="career-planets" />
        <div className="career-meteors" />
        <div className="career-shooting-star" />
      </div>

      <div className="career-content-layer">
        <header className="career-global-header">
          <div className="career-header-mark">TW</div>
          <div className="career-header-title">ThinkWrite AI · Career Studio</div>
        </header>

        <div className="career-panels-row overflow-hidden">
          <div className="career-panel flex-1 overflow-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="text-white/80 text-sm uppercase tracking-[0.22em]">
                Career Assessment Results
              </div>
              <div className="flex gap-2">
                <button
                  className="px-3 py-2 text-xs rounded-lg border border-white/15 text-white/70 hover:text-white hover:bg-white/5 transition"
                  onClick={() => router.push("/career-studio/dashboard?workspace=assessment")}
                >
                  Retake Assessment
                </button>
                <button
                  className="px-3 py-2 text-xs rounded-lg border border-white/15 text-white/70 hover:text-white hover:bg-white/5 transition"
                  onClick={() => router.push("/career-studio/dashboard")}
                >
                  Back to Dashboard
                </button>
              </div>
            </div>

            {loading && (
              <div className="text-white/50 text-sm">Loading results…</div>
            )}

            {error && (
              <div className="text-red-300 text-sm">{error}</div>
            )}

            {result && (
              <>
                <section className="career-card rounded-2xl p-6 space-y-6">
                  <h2 className="text-white text-base uppercase tracking-[0.18em]">Career Profile</h2>

                  <div className="grid gap-6 md:grid-cols-2 text-sm text-white/70">
                    <div className="space-y-3">
                      <div className="text-white/40 uppercase text-xs tracking-wide">Current State</div>
                      <div className="text-white/85 text-base">
                        {result.profile?.currentTitle || "Not specified"}
                      </div>
                      <div className="text-white/55">
                        {result.profile?.currentCompany || "Company not specified"}
                      </div>
                      <div className="text-white/65">
                        Energy level: {result.profile?.energyLevel ?? "Not specified"}
                      </div>
                      <div className="text-white/65">
                        Gains: {formatList(result.profile?.primaryGains)}
                      </div>
                      <div className="text-white/65">
                        Drains: {formatList(result.profile?.primaryDrains)}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="text-white/40 uppercase text-xs tracking-wide">Non‑Negotiables</div>
                      <div className="text-white/65">
                        Compensation minimum: {formatCurrency(result.profile?.compensationMinimum)}
                      </div>
                      <div className="text-white/65">
                        Compensation target: {formatCurrency(result.profile?.compensationTarget)}
                      </div>
                      <div className="text-white/65">
                        Location: {result.profile?.locationType || "Not specified"}
                      </div>
                      <div className="text-white/65">
                        Company stage: {result.profile?.companyStage || "Not specified"}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="text-white/40 uppercase text-xs tracking-wide">Vision</div>
                      <div className="text-white/85 text-base">
                        Target title: {result.profile?.targetTitle || "Not specified"}
                      </div>
                      <div className="text-white/65">
                        Target companies: {formatList(result.profile?.targetCompanies)}
                      </div>
                      <div className="text-white/65">
                        Daily work: {result.profile?.dailyWorkDescription || "Not specified"}
                      </div>
                      <div className="text-white/65">
                        Impact goal: {result.profile?.impactGoal || "Not specified"}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="text-white/40 uppercase text-xs tracking-wide">Gaps & Readiness</div>
                      <div className="text-white/65">
                        Skill gaps: {(result.profile?.skillGaps || [])
                          .map((gap: any) => `${gap.skill}${gap.priority ? ` (${gap.priority}/10)` : ""}`)
                          .join(", ") || "Not specified"}
                      </div>
                      <div className="text-white/65">
                        Experience gaps: {formatList(result.profile?.experienceGaps)}
                      </div>
                      <div className="text-white/65">
                        Readiness score: {result.profile?.readinessScore ?? "Not scored"}
                      </div>
                      <div className="text-white/65">
                        Risk factors: {formatList(result.profile?.riskFactors)}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="career-card rounded-2xl p-6 space-y-4">
                  <h2 className="text-white text-sm uppercase tracking-[0.2em]">Phased Action Plan</h2>
                  <div className="grid gap-3 text-[11px] text-white/70 md:grid-cols-3">
                    <div>
                      Total timeline: {result.actionPlan?.totalMonths ?? "Not specified"} months
                    </div>
                    <div>
                      Weekly effort: {result.actionPlan?.hoursPerWeek ?? "Not specified"} hours
                    </div>
                    <div>
                      Estimated cost: {formatCurrency(result.actionPlan?.estimatedCost)}
                    </div>
                  </div>

                  <div className="space-y-3 text-[11px] text-white/70">
                    {(result.actionPlan?.phases || []).map((phase: any) => (
                      <details key={phase.phaseNumber} className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <summary className="cursor-pointer text-white/80">
                          Phase {phase.phaseNumber}: {phase.title} · {phase.duration}
                        </summary>
                        <div className="mt-3 space-y-3">
                          {(phase.items || []).map((item: any, idx: number) => (
                            <div key={`${phase.phaseNumber}-${idx}`} className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-2">
                              <div className="text-white/80">{item.action}</div>
                              <div className="text-white/50">{item.why}</div>
                              {(item.resources || []).length > 0 && (
                                <div className="text-white/50">
                                  Resources: {(item.resources || [])
                                    .map((resource: any) => {
                                      const cost = resource.cost ? ` · ${formatCurrency(resource.cost)}` : "";
                                      const time = resource.time ? ` · ${resource.time}` : "";
                                      return `${resource.name || "Resource"}${cost}${time}`;
                                    })
                                    .join(" | ")}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </section>

                <section className="career-card rounded-2xl p-6 space-y-3">
                  <h2 className="text-white text-sm uppercase tracking-[0.2em]">Ongoing Accountability</h2>
                  <p className="text-[11px] text-white/70">
                    Lex will check if you’re drifting from the plan, flag misaligned job moves,
                    and keep your target role and non‑negotiables visible as you progress.
                  </p>
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
