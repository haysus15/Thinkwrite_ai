"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

type IngestionPolicy = {
  include_extension: boolean;
  include_uploads: boolean;
  min_word_count: number;
  excluded_domains: string[];
};

const DEFAULT_POLICY: IngestionPolicy = {
  include_extension: true,
  include_uploads: true,
  min_word_count: 50,
  excluded_domains: [],
};

export default function MirrorSettingsPage() {
  const t = useTranslations();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const { user, loading, profile } = useAuth();
  const [policy, setPolicy] = useState<IngestionPolicy>(DEFAULT_POLICY);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/?auth=required&redirect=/mirror-mode/settings");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    supabase
      .from("mirror_settings")
      .select("ingestion_policy")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data?.ingestion_policy) return;
        setPolicy({
          include_extension: data.ingestion_policy.include_extension ?? true,
          include_uploads: data.ingestion_policy.include_uploads ?? true,
          min_word_count: data.ingestion_policy.min_word_count ?? 50,
          excluded_domains: Array.isArray(data.ingestion_policy.excluded_domains)
            ? data.ingestion_policy.excluded_domains
            : [],
        });
      });

    return () => {
      active = false;
    };
  }, [supabase, user?.id]);

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    setMessage(null);

    const { error } = await supabase.from("mirror_settings").upsert(
      {
        user_id: user.id,
        ingestion_policy: policy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    setSaving(false);
    setMessage(
      error ? t("settingsPages.mirror.messages.saveError") : t("settingsPages.mirror.messages.saveSuccess")
    );
  };

  if (loading || !user) {
    return <div className="min-h-screen bg-[#0f0e0c]" />;
  }

  return (
    <SettingsPageShell
      title={t("settingsPages.mirror.title")}
      subtitle={t("settingsPages.mirror.subtitle")}
      backHref="/mirror-mode/dashboard"
      backLabel={t("settingsPages.mirror.back")}
    >
      <section className={settingsCardClass}>
        <SectionLabel>{t("settingsPages.mirror.languageScope.section")}</SectionLabel>
        <div className="mt-5 space-y-3 text-[13px] text-white/65">
          <p className="font-[Georgia] text-[15px] text-[#e8e4dc]">
            {t("settingsPages.mirror.languageScope.title", {
              language: getLanguageLabel(profile?.preferred_language || "en"),
            })}
          </p>
          <p>{t("settingsPages.mirror.languageScope.body1")}</p>
          <p>{t("settingsPages.mirror.languageScope.body2")}</p>
          <Link href="/settings" className="inline-block text-[#a0aed4] underline underline-offset-4">
            {t("settingsPages.common.manageLanguage")}
          </Link>
        </div>
      </section>

      <section className={settingsCardClass}>
        <SectionLabel>{t("settingsPages.mirror.form.ingestionPolicy.section")}</SectionLabel>
        <div className="mt-5 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-[Georgia] text-[14px] text-[#e8e4dc]">{t("settingsPages.mirror.form.ingestionPolicy.includeExtension")}</p>
              <p className="mt-2 text-[12px] text-white/35">
                {t("settingsPages.mirror.form.ingestionPolicy.includeExtensionBody")}
              </p>
            </div>
            <input
              type="checkbox"
              checked={policy.include_extension}
              onChange={(event) =>
                setPolicy((current) => ({
                  ...current,
                  include_extension: event.target.checked,
                }))
              }
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-[Georgia] text-[14px] text-[#e8e4dc]">{t("settingsPages.mirror.form.ingestionPolicy.includeUploads")}</p>
              <p className="mt-2 text-[12px] text-white/35">
                {t("settingsPages.mirror.form.ingestionPolicy.includeUploadsBody")}
              </p>
            </div>
            <input
              type="checkbox"
              checked={policy.include_uploads}
              onChange={(event) =>
                setPolicy((current) => ({
                  ...current,
                  include_uploads: event.target.checked,
                }))
              }
            />
          </div>

          <div className="space-y-3">
            <SectionLabel>{t("settingsPages.mirror.form.ingestionPolicy.minimumWordCount")}</SectionLabel>
            <input
              type="range"
              min={25}
              max={200}
              value={policy.min_word_count}
              onChange={(event) =>
                setPolicy((current) => ({
                  ...current,
                  min_word_count: Number(event.target.value),
                }))
              }
              className="w-full"
            />
            <p className="text-[12px] text-white/35">
              {t("settingsPages.mirror.form.ingestionPolicy.currentWords", { count: policy.min_word_count })}
            </p>
          </div>

          <div className="space-y-3">
            <SectionLabel>{t("settingsPages.mirror.form.ingestionPolicy.excludedDomains")}</SectionLabel>
            <TagInput
              value={policy.excluded_domains}
              onChange={(excluded_domains) =>
                setPolicy((current) => ({
                  ...current,
                  excluded_domains,
                }))
              }
              placeholder={t("settingsPages.mirror.form.ingestionPolicy.placeholder")}
              maxTags={12}
            />
            <p className="text-[12px] text-white/35">{t("settingsPages.mirror.form.ingestionPolicy.examples")}</p>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-4">
        <button type="button" onClick={() => void save()} disabled={saving} className={settingsPrimaryButtonClass}>
          {saving ? t("settingsPages.common.saving") : t("settingsPages.mirror.form.save")}
        </button>
        {message ? <p className="text-[13px] text-white/55">{message}</p> : null}
      </div>

      <div className="space-y-3 text-[13px] text-white/45">
        <SectionLabel>{t("settingsPages.mirror.form.moreControls.section")}</SectionLabel>
        <Link href="/mirror-mode/dashboard?tab=identity" className="block text-[#a0aed4] underline underline-offset-4">
          {t("settingsPages.mirror.form.moreControls.identity")}
        </Link>
        <Link href="/mirror-mode/dashboard?tab=archive" className="block text-[#a0aed4] underline underline-offset-4">
          {t("settingsPages.mirror.form.moreControls.history")}
        </Link>
      </div>
    </SettingsPageShell>
  );
}
