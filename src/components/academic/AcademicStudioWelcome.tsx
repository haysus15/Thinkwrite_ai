"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  Calculator,
  Calendar,
  ClipboardList,
  Code2,
  FileText,
  GraduationCap,
  UserCheck,
} from "lucide-react";
import StudioHeader from "@/components/shared/StudioHeader";

export default function AcademicStudioWelcome() {
  const t = useTranslations("academic.studioShared.welcome");
  return (
    <div className="academic-root academic-landing-root relative min-h-screen text-slate-100">
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

      <header className="fixed inset-x-0 top-0 z-50 h-14 border-b border-white/5 bg-black/10 backdrop-blur-sm">
        <div className="mx-auto h-full w-full max-w-[1600px] px-5">
          <StudioHeader studioName={t("studioName")} persona="victor" settingsHref="/academic/settings" />
        </div>
      </header>

      <section className="relative z-10 flex h-screen justify-center px-6 pt-24 md:pt-28">
        <div className="mt-40 w-full max-w-4xl md:mt-52">
          <p className="text-[10px] tracking-[0.3em] text-slate-300">{t("eyebrow")}</p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight text-slate-100 max-md:text-4xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-4 text-sm text-slate-300">
            {t("heroBody")}
          </p>
          <Link
            href="/academic"
            className="mt-8 inline-flex items-center rounded-xl border border-sky-300/70 bg-sky-500/55 px-6 py-3 text-sm font-medium text-sky-50 transition hover:bg-sky-500/65"
          >
            {t("enterStudio")}
          </Link>
        </div>

        <div className="pointer-events-auto absolute bottom-10 left-0 right-0 flex justify-center">
          <Link href="#learn" className="text-sm text-slate-300/70 transition hover:text-slate-100">
            {t("learnHowItWorks")}
          </Link>
        </div>
      </section>

      <section id="learn" className="relative z-20 px-6 pb-14 pt-20">
        <div className="mx-auto w-full max-w-[1600px]">
          <div className="mx-auto w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-900/30 p-5 backdrop-blur-sm">
            <p className="text-xs text-slate-300">{t("pace")}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-lg font-semibold text-slate-100">{t("victor.name")}</p>
                <p className="mt-1 text-[10px] tracking-[0.24em] text-slate-400">{t("victor.eyebrow")}</p>
                <p className="mt-3 text-sm text-slate-300">
                  {t("victor.body")}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-lg font-semibold text-slate-100">{t("travis.name")}</p>
                <p className="mt-1 text-[10px] tracking-[0.24em] text-slate-400">{t("travis.eyebrow")}</p>
                <p className="mt-3 text-sm text-slate-300">
                  {t("travis.body")}
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {[
                t("details.0"),
                t("details.1"),
                t("details.2"),
                t("details.3"),
              ].map((line) => (
                <details
                  key={line}
                  className="rounded-lg border border-white/10 bg-slate-950/25 px-3 py-2 text-sm text-slate-200"
                >
                  <summary className="cursor-pointer list-none">{line}</summary>
                  <p className="mt-2 text-xs text-slate-400">
                    {t("detailBody")}
                  </p>
                </details>
              ))}
            </div>
          </div>

          <div className="mx-auto mt-16 text-center">
            <p className="text-4xl font-semibold text-slate-100">{t("readyTitle")}</p>
            <Link
              href="/academic"
              className="mt-5 inline-flex items-center rounded-xl border border-sky-300/40 bg-sky-500/25 px-6 py-3 text-sm font-medium text-sky-100 transition hover:bg-sky-500/35"
            >
              {t("enterStudio")}
            </Link>
            <p className="mt-2 text-xs text-slate-400">{t("requiresAccount")}</p>
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
                        {t("operatingSystemTitle")}
                      </h2>
                      <p className="mt-4 text-base leading-relaxed text-slate-300">
                        {t("operatingSystemBody")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-sky-300/25 bg-slate-950/25 p-6 backdrop-blur-sm">
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ClipboardList className="h-4 w-4 text-sky-200" />
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-300">{t("studioStatus")}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <div className="text-xs text-emerald-300/80">{t("active")}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <StatusCard title={t("statusCards.assignments.title")} value={t("statusCards.assignments.value")} hint={t("statusCards.assignments.hint")} />
                    <StatusCard title={t("statusCards.paper.title")} value={t("statusCards.paper.value")} hint={t("statusCards.paper.hint")} />
                    <StatusCard title={t("statusCards.study.title")} value={t("statusCards.study.value")} hint={t("statusCards.study.hint")} />
                    <StatusCard title={t("statusCards.mathCode.title")} value={t("statusCards.mathCode.value")} hint={t("statusCards.mathCode.hint")} />
                  </div>
                </div>
              </section>

              <aside className="space-y-6 lg:col-span-5">
                <div className="rounded-2xl border border-sky-300/25 bg-slate-950/25 p-6 backdrop-blur-sm">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
                    <BookOpen className="h-5 w-5 text-sky-200" />
                    {t("whatYouCanDo")}
                  </h3>
                  <ul className="space-y-3 text-sm text-slate-300">
                    <li className="flex items-start gap-3">
                      <Calendar className="mt-0.5 h-4 w-4 text-sky-200" />
                      <span>{t("capabilities.0")}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <FileText className="mt-0.5 h-4 w-4 text-sky-200" />
                      <span>{t("capabilities.1")}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <BookOpen className="mt-0.5 h-4 w-4 text-sky-200" />
                      <span>{t("capabilities.2")}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Calculator className="mt-0.5 h-4 w-4 text-sky-200" />
                      <span>{t("capabilities.3")}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Code2 className="mt-0.5 h-4 w-4 text-sky-200" />
                      <span>{t("capabilities.4")}</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-sky-300/25 bg-slate-950/25 p-6 backdrop-blur-sm">
                  <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-100">
                    <UserCheck className="h-5 w-5 text-sky-200" />
                    {t("howTheyHelp")}
                  </h3>
                  <p className="mb-6 text-sm text-slate-300">
                    {t("howTheyHelpBody")}
                  </p>

                  <div className="space-y-4">
                    <Rule title={t("rules.victor.title")} text={t("rules.victor.text")} />
                    <Rule title={t("rules.travis.title")} text={t("rules.travis.text")} />
                    <Rule title={t("rules.together.title")} text={t("rules.together.text")} />
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
    <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
      <p className="text-sm font-semibold text-slate-100">{title}</p>
      <p className="mt-2 text-sm text-slate-300">{text}</p>
    </div>
  );
}
