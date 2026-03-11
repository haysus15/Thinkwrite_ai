"use client";

import Link from "next/link";
import Image from "next/image";
import { BookOpen, Calculator, Calendar, ClipboardList, Code2, FileText, GraduationCap, UserCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AcademicStudioLandingPage() {
  return (
    <div className="academic-studio-root academic-landing-root relative min-h-screen text-slate-100">
      <div className="sky-layer fixed inset-0">
        <div className="stars" />
        <div className="stars-twinkle" />
        <div className="stars-glow" />
        <div className="nebula-glow" />
        <div
          className="milky-way-band"
          style={{
            top: "calc(-13% - 340px)",
            opacity: 0.94,
            filter: "blur(0.6px) saturate(1.45)",
            transform: "rotate(-18deg) scale(1.06)",
          }}
        />
        <div
          className="milky-way-band-warm-haze"
          style={{
            top: "calc(-13% - 340px)",
            opacity: 0.9,
            filter: "blur(32px) saturate(1.2)",
            transform: "rotate(-18deg) scale(1.08)",
          }}
        />
      </div>

      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200/10 bg-black/70 backdrop-blur-md">
        <div className="mx-auto flex h-12 w-full max-w-7xl items-center px-6">
          <Link href="/select-studio" className="inline-flex items-center hover:opacity-85 transition-opacity">
            <Image
              src="/thinkwrite-logo-transparent.png"
              alt="THINKWRITE AI"
              width={160}
              height={24}
              className="h-auto w-auto max-h-4"
              priority
            />
          </Link>
        </div>
      </nav>

      <section className="relative z-10 flex h-screen justify-center px-6 pt-24 md:pt-28">
        <div className="mt-40 w-full max-w-4xl md:mt-52">
          <p className="text-[10px] tracking-[0.3em] text-slate-300">ACADEMIC STUDIO</p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight text-slate-100 max-md:text-4xl">
            Victor and Travis are here to push the work forward.
          </h1>
          <p className="mt-4 text-sm text-slate-300">
            Rigorous thinking. Clear requirements. No shortcuts.
          </p>
          <Link
            href="/academic"
            className="mt-8 inline-flex items-center rounded-xl border border-sky-300/70 bg-sky-500/55 px-6 py-3 text-sm font-medium text-sky-50 transition hover:bg-sky-500/65"
          >
            Enter Academic Studio
          </Link>
        </div>

        <div className="pointer-events-auto absolute bottom-10 left-0 right-0 flex justify-center">
          <Link href="#learn" className="text-sm text-slate-300/70 transition hover:text-slate-100">
            ↓ Learn How It Works
          </Link>
        </div>
      </section>

      <section id="learn" className="relative z-20 px-6 pb-14 pt-20">
        <div className="mx-auto w-full max-w-[1600px]">
          <div className="mx-auto w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-900/30 p-5 backdrop-blur-sm">
          <p className="text-xs text-slate-300">Victor and Travis set the pace.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-lg font-semibold text-slate-100">Victor</p>
              <p className="mt-1 text-[10px] tracking-[0.24em] text-slate-400">SOCRATIC RIGOR</p>
              <p className="mt-3 text-sm text-slate-300">
                Challenges your thinking. Asks the hard questions. Won&apos;t let weak arguments slide. Uses the Socratic method to guide you to answers - never hands them to you.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-lg font-semibold text-slate-100">Travis</p>
              <p className="mt-1 text-[10px] tracking-[0.24em] text-slate-400">KEEPING TRACK</p>
              <p className="mt-3 text-sm text-slate-300">
                Manages deadlines and requirements. Knows what&apos;s due and what&apos;s missing. Steps in when Victor gets too intense. Results-focused, practical, direct.
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {[
              "Outline to checkpoint, no skipped steps.",
              "Five ways Victor helps.",
              "Travis keeps you accountable.",
              "Built for learning, not shortcuts.",
            ].map((line) => (
              <details
                key={line}
                className="rounded-lg border border-white/10 bg-slate-950/25 px-3 py-2 text-sm text-slate-200"
              >
                <summary className="cursor-pointer list-none">{line}</summary>
                <p className="mt-2 text-xs text-slate-400">
                  Academic Studio keeps expectations explicit so progress is clear and trackable.
                </p>
              </details>
            ))}
          </div>
        </div>

          <div className="mx-auto mt-16 text-center">
          <p className="text-4xl font-semibold text-slate-100">Ready to work?</p>
          <Link
            href="/academic"
            className="mt-5 inline-flex items-center rounded-xl border border-sky-300/40 bg-sky-500/25 px-6 py-3 text-sm font-medium text-sky-100 transition hover:bg-sky-500/35"
          >
            Enter Academic Studio
          </Link>
          <p className="mt-2 text-xs text-slate-400">Requires ThinkWrite account</p>
        </div>

          <div className="mx-auto mt-20 w-full max-w-6xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <section className="space-y-6 lg:col-span-7">
              <div className="rounded-2xl border border-sky-300/25 bg-slate-950/25 p-8 backdrop-blur-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sky-300/30 bg-sky-400/10">
                    <GraduationCap className="h-6 w-6 text-sky-200" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-100">
                      Academic Studio is your full coursework operating system.
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-slate-300">
                      Plan assignments, build papers from outline to submission-ready draft, generate quizzes from your notes, and solve math or coding work with step-by-step coaching. Victor pushes rigor. Travis keeps deadlines and next actions clear.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-sky-300/25 bg-slate-950/25 p-6 backdrop-blur-sm">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-4 w-4 text-sky-200" />
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-300">Studio Status</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <div className="text-xs text-emerald-300/80">ACTIVE</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <StatusCard title="Assignments" value="Prioritized" hint="See what is due next and where to continue." />
                  <StatusCard title="Paper Workflow" value="Outline to Export" hint="Move from structure to full draft with checkpoints." />
                  <StatusCard title="Study Hub" value="Quiz Ready" hint="Upload notes and generate practice immediately." />
                  <StatusCard title="Math + Code" value="Step Coaching" hint="Work line-by-line with verification and recovery." />
                </div>
              </div>
            </section>

            <aside className="space-y-6 lg:col-span-5">
              <div className="rounded-2xl border border-sky-300/25 bg-slate-950/25 p-6 backdrop-blur-sm">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
                  <BookOpen className="h-5 w-5 text-sky-200" />
                  What You Can Do Here
                </h3>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <Calendar className="mt-0.5 h-4 w-4 text-sky-200" />
                    <span>See urgency in one glance and jump straight to the next assignment.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-4 w-4 text-sky-200" />
                    <span>Build papers with outline, generation, checkpoints, and library export.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <BookOpen className="mt-0.5 h-4 w-4 text-sky-200" />
                    <span>Turn notes into quizzes fast with defaults for last-minute study.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Calculator className="mt-0.5 h-4 w-4 text-sky-200" />
                    <span>Solve math problems with verification, completion summaries, and practice follow-up.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Code2 className="mt-0.5 h-4 w-4 text-sky-200" />
                    <span>Work coding challenges with guided review, completion loops, and set tracking.</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-sky-300/25 bg-slate-950/25 p-6 backdrop-blur-sm">
                <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-100">
                  <UserCheck className="h-5 w-5 text-sky-200" />
                  How Victor + Travis Help
                </h3>
                <p className="mb-6 text-sm text-slate-300">
                  Victor challenges reasoning and depth. Travis manages sequence, urgency, and completion pressure.
                </p>

                <div className="space-y-4">
                  <Rule title="Victor: Socratic Rigor" text="He asks why each step works, catches weak logic, and pushes conceptual clarity." />
                  <Rule title="Travis: Execution Control" text="He surfaces deadlines, identifies the next action, and keeps momentum under time pressure." />
                  <Rule title="Together: No Lost Progress" text="You can switch workflows without losing state, then return exactly where you left off." />
                </div>
              </div>
            </aside>
          </div>
        </div>
        </div>
      </section>
      </div>
  );
}

function StatusCard({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{title}</p>
      <p className="mt-2 text-sm font-semibold text-slate-100">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

function Rule({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/25 p-4">
      <p className="text-sm font-medium text-slate-100">{title}</p>
      <p className="mt-1 text-sm text-slate-300">{text}</p>
    </div>
  );
}
