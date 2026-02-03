"use client";

import Link from "next/link";

const workflowSteps = [
  {
    title: "Outline",
    description: "Victor challenges your structure until it's solid.",
  },
  {
    title: "Generate",
    description: "Paper written in YOUR voice via Mirror Mode.",
  },
  {
    title: "Checkpoint",
    description: "Prove you understand what you wrote.",
  },
  {
    title: "Export",
    description: "Download only after passing.",
  },
];

const victorModes = [
  {
    title: "Default",
    description: "General guidance and homework support.",
  },
  {
    title: "Idea Expansion",
    description: "Break open ideas from multiple angles.",
  },
  {
    title: "Challenge",
    description: "Stress-test arguments and structure.",
  },
  {
    title: "Study",
    description: "Quiz prep and concept review.",
  },
  {
    title: "Math",
    description: "Show your work. Step-by-step verification.",
  },
];

const travisFeatures = [
  {
    title: "Syllabus extraction",
    description: "Upload syllabus and assignments auto-extract.",
  },
  {
    title: "Deadlines visible",
    description: "Upcoming deadlines stay in view across sessions.",
  },
  {
    title: "Requirements enforced",
    description: "Export stays locked until requirements are met.",
  },
];

const integrityPoints = [
  {
    title: "Understanding checkpoints",
    description: "You confirm you know what you wrote before export.",
  },
  {
    title: "Emergency skip",
    description: "One use per month for real emergencies, nothing more.",
  },
  {
    title: "Mirror Mode voice",
    description: "The draft stays in your voice, not generic AI text.",
  },
  {
    title: "Victor teaches",
    description: "He guides and challenges, he does not do your homework.",
  },
];

export default function AcademicStudioLandingPage() {
  const ctaHref = "/academic-studio/dashboard";

  return (
    <div className="academic-landing-root text-slate-100">
      <div className="sky-layer">
        <div className="stars" />
        <div className="milky-way-band" />
        <div className="milky-way-band-warm-haze" />
        <div className="nebula-glow" />
      </div>

      <div className="academic-landing-content">
        <section className="relative h-screen flex items-center justify-center px-6">
          <div className="max-w-5xl mx-auto text-left">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400 academic-reveal">
              Academic Studio
            </p>
            <h1
              className="text-4xl md:text-5xl font-semibold text-white mt-6 academic-reveal"
              style={{ animationDelay: "120ms" }}
            >
              Victor and Travis are here to push the work forward.
            </h1>
            <p
              className="text-slate-300 text-lg md:text-xl leading-relaxed mt-6 max-w-2xl academic-reveal"
              style={{ animationDelay: "220ms" }}
            >
              Rigorous thinking. Clear requirements. No shortcuts.
            </p>
            <div className="mt-10 academic-reveal" style={{ animationDelay: "320ms" }}>
              <Link
                href={ctaHref}
                className="inline-flex items-center justify-center px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/25"
              >
                Enter Academic Studio
              </Link>
            </div>
          </div>
          <div className="absolute bottom-10 left-0 right-0 flex justify-center text-white/60 text-sm animate-bounce">
            <a href="#learn-more">↓ Learn How It Works</a>
          </div>
        </section>

        <div id="learn-more" className="academic-accordion-stack px-6 pb-16">
          <details className="academic-accordion" open>
            <summary>Victor and Travis set the pace.</summary>
            <div className="academic-accordion-body">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="glass-panel relative p-6 academic-reveal">
                  <div className="absolute top-0 left-6 right-6 h-px bg-[#0EA5E9]/60" />
                  <h3 className="text-2xl font-semibold text-white">Victor</h3>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-400 mt-2">
                    Socratic rigor
                  </p>
                  <p className="text-slate-300 text-lg leading-relaxed mt-4">
                    Challenges your thinking. Asks the hard questions. Won&apos;t let
                    weak arguments slide. Uses the Socratic method to guide you to
                    answers - never hands them to you.
                  </p>
                </div>
                <div
                  className="glass-panel relative p-6 academic-reveal"
                  style={{ animationDelay: "150ms" }}
                >
                  <div className="absolute top-0 left-6 right-6 h-px bg-[#14B8A6]/60" />
                  <h3 className="text-2xl font-semibold text-white">Travis</h3>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-400 mt-2">
                    Keeping track
                  </p>
                  <p className="text-slate-300 text-lg leading-relaxed mt-4">
                    Manages deadlines and requirements. Knows what&apos;s due and what&apos;s
                    missing. Steps in when Victor gets too intense. Results-focused,
                    practical, direct.
                  </p>
                </div>
              </div>
            </div>
          </details>

          <details className="academic-accordion">
            <summary>Outline to checkpoint, no skipped steps.</summary>
            <div className="academic-accordion-body">
              <p className="text-slate-300 text-lg leading-relaxed mb-8 max-w-3xl">
                The workflow is linear on purpose. Each stage locks in quality
                before you move forward.
              </p>
              <div className="relative">
                <div className="absolute left-6 right-6 top-1/2 h-px bg-white/10 hidden lg:block" />
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  {workflowSteps.map((step, index) => (
                    <div
                      key={step.title}
                      className="glass-panel relative p-6 academic-reveal"
                      style={{ animationDelay: `${index * 120}ms` }}
                    >
                      <div className="text-sm uppercase tracking-[0.3em] text-slate-400">
                        Step {index + 1}
                      </div>
                      <h3 className="text-xl font-semibold text-white mt-3">
                        {step.title}
                      </h3>
                      <p className="text-slate-300 mt-3 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </details>

          <details className="academic-accordion">
            <summary>Five ways Victor helps.</summary>
            <div className="academic-accordion-body">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
                {victorModes.map((mode, index) => (
                  <div
                    key={mode.title}
                    className="glass-panel p-5 academic-reveal"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <h3 className="text-lg font-semibold text-white">
                      {mode.title}
                    </h3>
                    <p className="text-slate-300 mt-3 leading-relaxed">
                      {mode.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </details>

          <details className="academic-accordion">
            <summary>Travis keeps you accountable.</summary>
            <div className="academic-accordion-body">
              <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
                <div className="grid gap-6">
                  {travisFeatures.map((feature, index) => (
                    <div
                      key={feature.title}
                      className="glass-panel p-6 academic-reveal"
                      style={{ animationDelay: `${index * 120}ms` }}
                    >
                      <h3 className="text-xl font-semibold text-white">
                        {feature.title}
                      </h3>
                      <p className="text-slate-300 mt-3 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  ))}
                </div>
                <div
                  className="glass-panel p-6 academic-reveal"
                  style={{ animationDelay: "200ms" }}
                >
                  <div className="text-sm uppercase tracking-[0.3em] text-slate-400">
                    Travis sidebar
                  </div>
                  <div className="mt-6 space-y-4">
                    <div className="h-10 rounded-lg bg-white/5 border border-white/5" />
                    <div className="space-y-3">
                      <div className="h-14 rounded-xl bg-white/5 border border-white/5" />
                      <div className="h-14 rounded-xl bg-white/5 border border-white/5" />
                      <div className="h-14 rounded-xl bg-white/5 border border-white/5" />
                    </div>
                    <div className="h-10 rounded-lg bg-white/5 border border-white/5" />
                  </div>
                </div>
              </div>
            </div>
          </details>

          <details className="academic-accordion">
            <summary>Built for learning, not shortcuts.</summary>
            <div className="academic-accordion-body">
              <div className="grid gap-6 md:grid-cols-2">
                {integrityPoints.map((point, index) => (
                  <div
                    key={point.title}
                    className="glass-panel p-6 academic-reveal"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <h3 className="text-xl font-semibold text-white">
                      {point.title}
                    </h3>
                    <p className="text-slate-300 mt-3 leading-relaxed">
                      {point.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </details>

        </div>

        <section className="flex items-center justify-center px-6 pb-16">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to work?
            </h2>
            <div className="academic-reveal" style={{ animationDelay: "120ms" }}>
              <Link
                href={ctaHref}
                className="inline-flex items-center justify-center px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/25"
              >
                Enter Academic Studio
              </Link>
            </div>
            <p className="text-slate-400 mt-4 text-sm">
              Requires ThinkWrite account
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
