"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import {
  FieldLabel,
  SectionLabel,
  SettingsPageShell,
  settingsCardClass,
} from "@/components/settings/SettingsPrimitives";
import { getLanguageLabel } from "@/lib/language/constants";
import { useAcademicSettings } from "@/hooks/academic/useAcademicSettings";

const OPTION_CARD_CLASS =
  "rounded-xl border border-white/10 bg-white/[0.03] p-4 transition";

export default function AcademicSettingsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { settings, updateSetting, loading: settingsLoading, preferredLanguage } =
    useAcademicSettings(user?.id);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/?auth=required&redirect=/academic/settings");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!savedMessage) return;
    const timer = window.setTimeout(() => setSavedMessage(null), 2200);
    return () => window.clearTimeout(timer);
  }, [savedMessage]);

  const applySetting = async (
    key:
      | "sessionEntryPreference"
      | "travisSessionMemory"
      | "victorAvailability",
    value: string | boolean
  ) => {
    try {
      setSavingKey(key);
      await updateSetting(
        key as never,
        value as never
      );
      setSavedMessage("Saved");
    } catch {
      setSavedMessage("Could not save");
    } finally {
      setSavingKey(null);
    }
  };

  if (loading || !user || settingsLoading) {
    return <div className="min-h-screen bg-[#0f0e0c]" />;
  }

  return (
    <SettingsPageShell
      title="Your Session Experience"
      subtitle="These controls shape how the Settings section behaves each time you enter Academic Studio."
      backHref="/academic"
      backLabel="Back to Academic Studio"
    >
      <section className={settingsCardClass}>
        <SectionLabel>Your Session Experience</SectionLabel>
        <div className="mt-5 space-y-3 text-[13px] text-white/65">
          <p className="font-[Georgia] text-[15px] text-[#e8e4dc]">
            Language-aware copy follows {getLanguageLabel(preferredLanguage || "en")}.
          </p>
          <p>
            Academic session settings apply immediately and stay tied to your
            account across visits.
          </p>
          <Link href="/settings" className="inline-block text-[#a0aed4] underline underline-offset-4">
            Manage global language settings
          </Link>
        </div>
      </section>

      <section className={settingsCardClass}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <SectionLabel>Session Entry Preference</SectionLabel>
            <p className="mt-3 font-[Georgia] text-[15px] text-[#e8e4dc]">
              How do you want to start each session?
            </p>
          </div>
          <SavedIndicator message={savedMessage} active={savingKey === "sessionEntryPreference"} />
        </div>
        <div className="mt-5 space-y-3">
          <label className={OPTION_CARD_CLASS}>
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="session-entry"
                checked={settings.sessionEntryPreference === "chat_first"}
                onChange={() => void applySetting("sessionEntryPreference", "chat_first")}
                className="mt-1"
              />
              <div>
                <FieldLabel>Talk to Victor and Travis first</FieldLabel>
                <p className="mt-2 text-sm text-[#e8e4dc]">
                  Start with a conversation. Tell them what you need and they
                  will open the right workspace for you.
                </p>
              </div>
            </div>
          </label>

          <label className={OPTION_CARD_CLASS}>
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="session-entry"
                checked={settings.sessionEntryPreference === "direct"}
                onChange={() => void applySetting("sessionEntryPreference", "direct")}
                className="mt-1"
              />
              <div>
                <FieldLabel>Go straight to my work</FieldLabel>
                <p className="mt-2 text-sm text-[#e8e4dc]">
                  Jump directly to your last active workflow or the dashboard.
                </p>
              </div>
            </div>
          </label>
        </div>
      </section>

      <section className={settingsCardClass}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <SectionLabel>Travis Session Memory</SectionLabel>
            <p className="mt-3 font-[Georgia] text-[15px] text-[#e8e4dc]">
              Let Travis remind me what I was working on last time
            </p>
            <p className="mt-2 text-sm text-white/50">
              When off, Travis greets you fresh each session.
            </p>
          </div>
          <SavedIndicator message={savedMessage} active={savingKey === "travisSessionMemory"} />
        </div>
        <label className="mt-5 flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4">
          <span className="text-sm text-[#e8e4dc]">
            {settings.travisSessionMemory ? "On" : "Off"}
          </span>
          <input
            type="checkbox"
            checked={settings.travisSessionMemory}
            onChange={(event) =>
              void applySetting("travisSessionMemory", event.target.checked)
            }
          />
        </label>
      </section>

      <section className={settingsCardClass}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <SectionLabel>Victor Availability</SectionLabel>
            <p className="mt-3 font-[Georgia] text-[15px] text-[#e8e4dc]">
              When should Victor be available?
            </p>
          </div>
          <SavedIndicator message={savedMessage} active={savingKey === "victorAvailability"} />
        </div>
        <div className="mt-5 space-y-3">
          <label className={OPTION_CARD_CLASS}>
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="victor-availability"
                checked={settings.victorAvailability === "workflow_only"}
                onChange={() => void applySetting("victorAvailability", "workflow_only")}
                className="mt-1"
              />
              <div>
                <FieldLabel>Only when I'm in a paper or math workflow</FieldLabel>
                <p className="mt-2 text-sm text-[#e8e4dc]">
                  Victor stays quiet outside paper and math, then activates when
                  you enter those studios.
                </p>
              </div>
            </div>
          </label>

          <label className={OPTION_CARD_CLASS}>
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="victor-availability"
                checked={settings.victorAvailability === "always"}
                onChange={() => void applySetting("victorAvailability", "always")}
                className="mt-1"
              />
              <div>
                <FieldLabel>Always available in the chat panel</FieldLabel>
                <p className="mt-2 text-sm text-[#e8e4dc]">
                  Victor stays reachable throughout the session, while keeping
                  the same Socratic-only contract.
                </p>
              </div>
            </div>
          </label>
        </div>
      </section>
    </SettingsPageShell>
  );
}

function SavedIndicator({
  message,
  active,
}: {
  message: string | null;
  active: boolean;
}) {
  return (
    <div className="min-w-16 text-right text-xs text-white/45">
      {active ? "Saving..." : message || ""}
    </div>
  );
}
