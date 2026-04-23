"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import TagInput from "@/components/settings/TagInput";
import {
  SectionLabel,
  SettingsPageShell,
  settingsCardClass,
  settingsInputClass,
  settingsPrimaryButtonClass,
} from "@/components/settings/SettingsPrimitives";
import { getLanguageLabel } from "@/lib/language/constants";

type Tone = "formal" | "confident" | "conversational";
type ResumeOption = { id: string; fileName: string; isMasterResume?: boolean };

export default function CareerSettingsPage() {
  const t = useTranslations();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const { user, loading, profile } = useAuth();
  const [resumes, setResumes] = useState<ResumeOption[]>([]);
  const [defaultResumeId, setDefaultResumeId] = useState<string>("");
  const [targetIndustries, setTargetIndustries] = useState<string[]>([]);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [tone, setTone] = useState<Tone>("confident");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/?auth=required&redirect=/career-studio/settings");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    fetch("/api/resumes")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setResumes(data?.resumes || []);
      })
      .catch(() => {
        if (!active) return;
        setResumes([]);
      });

    supabase
      .from("career_settings")
      .select("default_resume_id, target_industries, target_roles, default_cover_letter_tone")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setDefaultResumeId(data.default_resume_id || "");
        setTargetIndustries(Array.isArray(data.target_industries) ? data.target_industries : []);
        setTargetRoles(Array.isArray(data.target_roles) ? data.target_roles : []);
        setTone((data.default_cover_letter_tone as Tone) || "confident");
      });

    return () => {
      active = false;
    };
  }, [supabase, user?.id]);

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    setMessage(null);

    const { error } = await supabase.from("career_settings").upsert(
      {
        user_id: user.id,
        default_resume_id: defaultResumeId || null,
        target_industries: targetIndustries,
        target_roles: targetRoles,
        default_cover_letter_tone: tone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    setSaving(false);
    setMessage(
      error ? t("settingsPages.career.messages.saveError") : t("settingsPages.career.messages.saveSuccess")
    );
  };

  if (loading || !user) {
    return <div className="min-h-screen bg-[#0f0e0c]" />;
  }

  return (
    <SettingsPageShell
      title={t("settingsPages.career.title")}
      subtitle={t("settingsPages.career.subtitle")}
      backHref="/career-studio"
      backLabel={t("settingsPages.career.back")}
    >
      <section className={settingsCardClass}>
        <SectionLabel>{t("settingsPages.career.languageScope.section")}</SectionLabel>
        <div className="mt-5 space-y-3 text-[13px] text-white/65">
          <p className="font-[Georgia] text-[15px] text-[#e8e4dc]">
            {t("settingsPages.career.languageScope.title", {
              language: getLanguageLabel(profile?.preferred_language || "en"),
            })}
          </p>
          <p>{t("settingsPages.career.languageScope.body1")}</p>
          <p>{t("settingsPages.career.languageScope.body2")}</p>
          <Link href="/settings" className="inline-block text-[#a0aed4] underline underline-offset-4">
            {t("settingsPages.common.manageLanguage")}
          </Link>
        </div>
      </section>

      <section className={settingsCardClass}>
        <SectionLabel>{t("settingsPages.career.form.defaultResume.section")}</SectionLabel>
        <div className="mt-5 space-y-3">
          <p className="text-[13px] text-white/45">
            {t("settingsPages.career.form.defaultResume.body")}
          </p>
          {resumes.length > 0 ? (
            <select
              value={defaultResumeId}
              onChange={(event) => setDefaultResumeId(event.target.value)}
              className={settingsInputClass}
            >
              <option value="">{t("settingsPages.career.form.defaultResume.none")}</option>
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.fileName}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-[13px] text-white/45">
              {t("settingsPages.career.form.defaultResume.empty")}{" "}
              <Link href="/career-studio/resume-manager" className="text-[#a0aed4] underline underline-offset-4">
                {t("settingsPages.career.form.defaultResume.openManager")}
              </Link>
            </p>
          )}
        </div>
      </section>

      <section className={settingsCardClass}>
        <SectionLabel>{t("settingsPages.career.form.targetIndustries.section")}</SectionLabel>
        <div className="mt-5 space-y-3">
          <p className="text-[13px] text-white/45">
            {t("settingsPages.career.form.targetIndustries.body")}
          </p>
          <TagInput
            value={targetIndustries}
            onChange={setTargetIndustries}
            placeholder={t("settingsPages.career.form.targetIndustries.placeholder")}
            maxTags={6}
          />
          <p className="text-[12px] text-white/35">{t("settingsPages.career.form.targetIndustries.examples")}</p>
        </div>
      </section>

      <section className={settingsCardClass}>
        <SectionLabel>{t("settingsPages.career.form.targetRoles.section")}</SectionLabel>
        <div className="mt-5 space-y-3">
          <TagInput
            value={targetRoles}
            onChange={setTargetRoles}
            placeholder={t("settingsPages.career.form.targetRoles.placeholder")}
            maxTags={6}
          />
          <p className="text-[12px] text-white/35">{t("settingsPages.career.form.targetRoles.examples")}</p>
        </div>
      </section>

      <section className={settingsCardClass}>
        <SectionLabel>{t("settingsPages.career.form.coverLetterTone.section")}</SectionLabel>
        <div className="mt-5 space-y-4">
          <p className="text-[13px] text-white/45">
            {t("settingsPages.career.form.coverLetterTone.body")}
          </p>
          {[
            ["formal", t("settingsPages.career.form.coverLetterTone.formal"), t("settingsPages.career.form.coverLetterTone.formalDesc")],
            ["confident", t("settingsPages.career.form.coverLetterTone.confident"), t("settingsPages.career.form.coverLetterTone.confidentDesc")],
            ["conversational", t("settingsPages.career.form.coverLetterTone.conversational"), t("settingsPages.career.form.coverLetterTone.conversationalDesc")],
          ].map(([value, label, description]) => (
            <label key={value} className="flex items-start gap-3 text-[14px] text-[#e8e4dc]">
              <input
                type="radio"
                name="career-tone"
                checked={tone === value}
                onChange={() => setTone(value as Tone)}
                className="mt-1"
              />
              <span>
                <span className="block">{label}</span>
                <span className="block text-[12px] text-white/35">{description}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-4">
        <button type="button" onClick={() => void save()} disabled={saving} className={settingsPrimaryButtonClass}>
          {saving ? t("settingsPages.common.saving") : t("settingsPages.career.form.save")}
        </button>
        {message ? <p className="text-[13px] text-white/55">{message}</p> : null}
      </div>
    </SettingsPageShell>
  );
}
