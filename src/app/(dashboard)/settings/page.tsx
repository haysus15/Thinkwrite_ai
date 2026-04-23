"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { deriveAvatarColor, getInitials } from "@/lib/avatar";
import { defaultStudioToPath, normalizeDefaultStudio, type DefaultStudioValue } from "@/lib/auth/defaultStudio";
import { LOCALE_COOKIE_NAME } from "@/i18n/config";
import { getLanguageLabel } from "@/lib/language/constants";
import {
  FieldLabel,
  SectionLabel,
  SettingsPageShell,
  settingsCardClass,
  settingsDestructiveButtonClass,
  settingsDisabledInputClass,
  settingsInputClass,
  settingsPrimaryButtonClass,
} from "@/components/settings/SettingsPrimitives";
import DropdownSelect from "@/components/ui/DropdownSelect";
import LanguageSelector from "@/components/ui/LanguageSelector";

type ExtensionStatus = "checking" | "active" | "inactive";

export default function SettingsPage() {
  const t = useTranslations();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const { user, loading, profile, setProfile, refreshProfile } = useAuth();

  const [name, setName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationSending, setVerificationSending] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [globalSignOutSaving, setGlobalSignOutSaving] = useState(false);

  const [defaultStudio, setDefaultStudio] = useState<DefaultStudioValue>(null);
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [preferenceMessage, setPreferenceMessage] = useState<string | null>(null);
  const [preferenceSaving, setPreferenceSaving] = useState(false);
  const [bridgeModeSaving, setBridgeModeSaving] = useState(false);
  const [bridgeModeMessage, setBridgeModeMessage] = useState<string | null>(null);

  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus>("checking");
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/?auth=required&redirect=/settings");
    }
  }, [loading, router, user]);

  useEffect(() => {
    setName(profile?.name || "");
    setDefaultStudio(normalizeDefaultStudio(profile?.default_studio));
    setPreferredLanguage(profile?.preferred_language || "en");
  }, [profile?.default_studio, profile?.name, profile?.preferred_language]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setEmailVerified(Boolean(data.user?.email_confirmed_at));
    });

    supabase
      .from("mirror_extension_activity")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count, error }) => {
        if (!active) return;
        if (error) {
          setExtensionStatus("inactive");
          return;
        }
        setExtensionStatus((count || 0) > 0 ? "active" : "inactive");
      });

    return () => {
      active = false;
    };
  }, [supabase, user?.id]);

  const displayName = useMemo(() => {
    const emailPrefix = (profile?.email || user?.email || "").split("@")[0];
    return name.trim() || profile?.name || emailPrefix || "User";
  }, [name, profile?.email, profile?.name, user?.email]);

  const avatarColor = useMemo(
    () => profile?.avatar_color || deriveAvatarColor(displayName),
    [displayName, profile?.avatar_color]
  );
  const activeLanguageLabel = useMemo(
    () =>
      ({
        en: "English",
        es: "Español",
        fr: "Français",
        de: "Deutsch",
        pt: "Português",
        zh: "中文",
        ja: "日本語",
        ko: "한국어",
      })[preferredLanguage] || preferredLanguage.toUpperCase(),
    [preferredLanguage]
  );
  const bridgeModeEnabled = Boolean(profile?.bridge_mode_enabled);
  const bridgeSourceLanguage = profile?.bridge_mode_source_language || preferredLanguage;
  const bridgeTargetLanguage = profile?.bridge_mode_target_language || "en";
  const defaultStudioOptions = useMemo(
    () => [
      { value: "", label: t("settingsPages.common.studioSelector") },
      { value: "academic", label: t("nav.academicStudio") },
      { value: "career", label: t("nav.careerStudio") },
      { value: "mirror", label: t("nav.mirrorMode") },
    ],
    [t]
  );

  const handleProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.id) return;

    setProfileSaving(true);
    setProfileError(null);
    setProfileMessage(null);

    const trimmedName = name.trim();
    const { error } = await supabase
      .from("users")
      .update({ name: trimmedName, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      setProfileError(t("settingsPages.main.profile.saveError"));
      setProfileSaving(false);
      return;
    }

    setProfile((current) =>
      current
        ? {
            ...current,
            name: trimmedName,
          }
        : current
    );
    setProfileMessage(t("settingsPages.main.profile.saveSuccess"));
    setProfileSaving(false);
  };

  const handleResendVerification = async () => {
    if (!user?.email) return;
    setVerificationSending(true);
    setVerificationError(null);
    setVerificationMessage(null);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: user.email,
    });

    if (error) {
      setVerificationError(t("settingsPages.main.security.verification.resendError"));
    } else {
      setVerificationMessage(t("settingsPages.main.security.verification.resendSuccess"));
    }

    setVerificationSending(false);
  };

  const handlePasswordSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSecurityError(null);
    setSecurityMessage(null);

    if (!user?.email) {
      setSecurityError(t("settingsPages.main.security.password.accountVerifyError"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityError(t("settingsPages.main.security.password.mismatch"));
      return;
    }

    if (newPassword.length < 8) {
      setSecurityError(t("settingsPages.main.security.password.minLength"));
      return;
    }

    setPasswordSaving(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      setSecurityError(t("settingsPages.main.security.password.currentIncorrect"));
      setPasswordSaving(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setSecurityError(t("settingsPages.main.security.password.updateError"));
      setPasswordSaving(false);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSecurityMessage(t("settingsPages.main.security.password.updateSuccess"));
    setPasswordSaving(false);
  };

  const handleGlobalSignOut = async () => {
    setGlobalSignOutSaving(true);
    setSecurityError(null);
    setSecurityMessage(null);

    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) {
      setSecurityError(t("settingsPages.main.security.password.globalSignOutError"));
      setGlobalSignOutSaving(false);
      return;
    }

    router.push("/");
  };

  const handleDefaultStudioChange = async (value: string) => {
    if (!user?.id) return;
    const nextValue = normalizeDefaultStudio(value || null);
    setDefaultStudio(nextValue);
    setPreferenceSaving(true);
    setPreferenceMessage(null);

    const { error } = await supabase
      .from("users")
      .update({
        default_studio: nextValue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      setPreferenceMessage(t("settingsPages.main.studioDefaults.saveError"));
      setPreferenceSaving(false);
      return;
    }

    setProfile((current) =>
      current
        ? {
            ...current,
            default_studio: nextValue,
          }
        : current
    );
    setPreferenceMessage(
      t("settingsPages.main.studioDefaults.saveSuccess", {
        destination: nextValue ? defaultStudioToPath(nextValue) : "/select-studio",
      })
    );
    setPreferenceSaving(false);
  };

  const handlePreferredLanguageChange = async (language: string) => {
    if (!user?.id) return;

    setPreferredLanguage(language);
    setPreferenceSaving(true);
    setPreferenceMessage(null);

    const updatedAt = new Date().toISOString();
    const [{ error: profileError }, bridgeResponse] = await Promise.all([
      supabase.from("user_profiles").upsert(
        {
          user_id: user.id,
          preferred_language: language,
          updated_at: updatedAt,
        },
        { onConflict: "user_id" }
      ),
      profile?.bridge_mode_enabled
        ? fetch("/api/user/bridge-mode", {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({ bridge_mode_enabled: true }),
          })
        : Promise.resolve(null),
    ]);

    if (profileError || (bridgeResponse && !bridgeResponse.ok)) {
      setPreferenceMessage(t("settingsPages.main.language.saveError"));
      setPreferenceSaving(false);
      return;
    }

    const bridgeData = bridgeResponse ? await bridgeResponse.json() : null;

    setProfile((current) =>
      current
        ? {
            ...current,
            preferred_language: language,
            bridge_mode_enabled: bridgeData?.bridge_mode_enabled ?? current.bridge_mode_enabled,
            bridge_mode_source_language:
              bridgeData?.bridge_mode_source_language ??
              (current.bridge_mode_enabled ? language : current.bridge_mode_source_language),
            bridge_mode_target_language:
              bridgeData?.bridge_mode_target_language ?? current.bridge_mode_target_language,
          }
        : current
    );
    document.cookie = `${LOCALE_COOKIE_NAME}=${language}; path=/; max-age=31536000; samesite=lax`;
    setPreferenceMessage(
      t("settingsPages.main.language.saveSuccess", {
        language: language.toUpperCase(),
      })
    );
    setPreferenceSaving(false);
    router.refresh();
  };

  const handleBridgeModeToggle = async (enabled: boolean) => {
    if (!user?.id) return;

    setBridgeModeSaving(true);
    setBridgeModeMessage(null);

    const response = await fetch("/api/user/bridge-mode", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ bridge_mode_enabled: enabled }),
    });

    if (!response.ok) {
      setBridgeModeMessage(t("settingsPages.main.language.bridge.saveError"));
      setBridgeModeSaving(false);
      return;
    }

    const data = await response.json();

    setProfile((current) =>
      current
        ? {
            ...current,
            bridge_mode_enabled: Boolean(data.bridge_mode_enabled),
            bridge_mode_source_language: data.bridge_mode_source_language ?? current.bridge_mode_source_language,
            bridge_mode_target_language: data.bridge_mode_target_language || current.bridge_mode_target_language,
          }
        : current
    );
    setBridgeModeMessage(
      enabled
        ? t("settingsPages.main.language.bridge.enabledMessage")
        : t("settingsPages.main.language.bridge.disabledMessage")
    );
    setBridgeModeSaving(false);
  };

  useEffect(() => {
    if (user?.id && !profile) {
      void refreshProfile();
    }
  }, [profile, refreshProfile, user?.id]);

  if (loading || !user) {
    return <div className="min-h-screen bg-[#0f0e0c]" />;
  }

  const passwordsMatch = !newPassword || !confirmPassword || newPassword === confirmPassword;

  return (
    <SettingsPageShell
      title={t("settings.title")}
      subtitle={t("settingsPages.main.subtitle")}
      backHref="/select-studio"
      backLabel={t("settingsPages.common.backToStudioSelector")}
    >
      <section className={settingsCardClass}>
        <SectionLabel>{t("settingsPages.main.profile.section")}</SectionLabel>
        <form onSubmit={handleProfileSave} className="mt-5 space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full font-mono text-[18px] tracking-[0.05em] text-white"
                style={{ backgroundColor: avatarColor }}
              >
                {getInitials(displayName)}
              </div>
              <div className="mt-2 flex justify-center">
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-white/10 bg-[#14120f]">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: avatarColor }} />
                </span>
              </div>
            </div>
            <div className="text-[13px] text-white/45">
              <p>{t("settingsPages.main.profile.identityMarker")}</p>
              <p className="mt-1">{t("settingsPages.main.profile.photoUnavailable")}</p>
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel>{t("settingsPages.main.profile.displayName")}</FieldLabel>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={settingsInputClass}
            />
          </div>

          <div className="space-y-2">
            <FieldLabel>{t("settingsPages.main.profile.email")}</FieldLabel>
            <input
              disabled
              value={profile?.email || user.email || ""}
              className={settingsDisabledInputClass}
            />
            <p className="text-[12px] text-white/30">{t("settingsPages.main.profile.emailChangeUnsupported")}</p>
          </div>

          {profileError ? <p className="text-[13px] text-[#c4847a]">{profileError}</p> : null}
          {profileMessage ? <p className="text-[13px] text-[#9adbc0]">{profileMessage}</p> : null}

          <button type="submit" disabled={profileSaving} className={settingsPrimaryButtonClass}>
            {profileSaving ? t("settingsPages.common.saving") : t("settingsPages.main.profile.save")}
          </button>
        </form>
      </section>

      <section className={settingsCardClass}>
        <SectionLabel>{t("settingsPages.main.security.section")}</SectionLabel>
        <div className="mt-5 space-y-5">
          <div
            className={`rounded-[10px] border px-4 py-3 text-[13px] ${
              emailVerified
                ? "border-[rgba(91,174,138,0.2)] bg-[rgba(91,174,138,0.08)] text-[#9adbc0]"
                : "border-[rgba(174,138,91,0.22)] bg-[rgba(174,138,91,0.08)] text-[#d7bd8d]"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  emailVerified ? "bg-[#5BAE8A]" : "bg-[#d3a15a]"
                }`}
              />
              <span>
                {emailVerified === null
                  ? t("settingsPages.main.security.verification.checking")
                  : emailVerified
                    ? t("settingsPages.main.security.verification.verified")
                    : t("settingsPages.main.security.verification.unverified")}
              </span>
            </div>
            {!emailVerified && emailVerified !== null ? (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={verificationSending}
                className="mt-3 text-[13px] underline underline-offset-4 transition hover:text-white disabled:opacity-50"
              >
                {verificationSending
                  ? t("settingsPages.main.security.verification.sending")
                  : t("settingsPages.main.security.verification.resend")}
              </button>
            ) : null}
            {verificationMessage ? <p className="mt-3 text-[12px] text-[#9adbc0]">{verificationMessage}</p> : null}
            {verificationError ? <p className="mt-3 text-[12px] text-[#c4847a]">{verificationError}</p> : null}
          </div>

          <form onSubmit={handlePasswordSave} className="space-y-4">
            <div className="space-y-2">
              <FieldLabel>{t("settingsPages.main.security.password.current")}</FieldLabel>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className={settingsInputClass}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>{t("settingsPages.main.security.password.new")}</FieldLabel>
              <input
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className={settingsInputClass}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>{t("settingsPages.main.security.password.confirm")}</FieldLabel>
              <input
                type="password"
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={settingsInputClass}
              />
            </div>
            {!passwordsMatch ? (
              <p className="text-[13px] text-[#c4847a]">{t("settingsPages.main.security.password.mismatch")}</p>
            ) : null}
            {securityError ? <p className="text-[13px] text-[#c4847a]">{securityError}</p> : null}
            {securityMessage ? <p className="text-[13px] text-[#9adbc0]">{securityMessage}</p> : null}
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={passwordSaving || !passwordsMatch}
                className={settingsPrimaryButtonClass}
              >
                {passwordSaving
                  ? t("settingsPages.main.security.password.updating")
                  : t("settingsPages.main.security.password.update")}
              </button>
              <button
                type="button"
                onClick={handleGlobalSignOut}
                disabled={globalSignOutSaving}
                className={settingsDestructiveButtonClass}
              >
                {globalSignOutSaving
                  ? t("settingsPages.main.security.password.signingOut")
                  : t("settingsPages.main.security.password.globalSignOut")}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className={settingsCardClass}>
        <SectionLabel>{t("settingsPages.main.language.section")}</SectionLabel>
        <div className="mt-5 space-y-4">
          <div className="rounded-[10px] border border-[rgba(91,110,174,0.25)] bg-[rgba(91,110,174,0.08)] px-4 py-4 text-[13px] text-white/70">
            <p className="font-[Georgia] text-[15px] text-[#e8e4dc]">{t("settingsPages.main.language.title")}</p>
            <p className="mt-2">{t("settingsPages.main.language.body")}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-white/55">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                {t("nav.academicStudio")}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                {t("nav.careerStudio")}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                {t("nav.mirrorMode")}
              </span>
            </div>
          </div>
          <LanguageSelector
            value={preferredLanguage}
            onChange={(language) => void handlePreferredLanguageChange(language)}
            context="settings"
          />
          <p className="text-[12px] text-white/35">
            {t("settingsPages.main.language.current")} <span className="text-white/70">{activeLanguageLabel}</span>
          </p>
          <p className="text-[12px] text-white/35">
            {t("settingsPages.main.language.persistence")}
          </p>
          {preferredLanguage !== "en" ? (
            <div className="rounded-[14px] border border-[rgba(160,174,212,0.22)] bg-[rgba(160,174,212,0.06)] px-4 py-4 text-[13px] text-white/70">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#a0aed4]">
                    {t("settingsPages.main.language.bridge.eyebrow")}
                  </p>
                  {!bridgeModeEnabled ? (
                    <>
                      <p className="mt-2 font-[Georgia] text-[15px] text-[#e8e4dc]">
                        {t("settingsPages.main.language.bridge.offHeadline", {
                          language: activeLanguageLabel,
                        })}
                      </p>
                      <p className="mt-2">
                        {t("settingsPages.main.language.bridge.offBodyOne", {
                          language: activeLanguageLabel,
                        })}
                      </p>
                      <p className="mt-2">
                        {t("settingsPages.main.language.bridge.offBodyTwo", {
                          language: activeLanguageLabel,
                        })}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 font-[Georgia] text-[15px] text-[#e8e4dc]">
                        {t("settingsPages.main.language.bridge.onHeadline")}
                      </p>
                      <div className="mt-3 space-y-1.5 text-[12px] text-white/58">
                        <p>
                          {t("settingsPages.main.language.bridge.flow", {
                            sourceLanguage: getLanguageLabel(bridgeSourceLanguage),
                            targetLanguage: getLanguageLabel(bridgeTargetLanguage),
                          })}
                        </p>
                        <p>
                          {t("settingsPages.main.language.bridge.feedbackLanguage", {
                            language: activeLanguageLabel,
                          })}
                        </p>
                        <p>
                          {t("settingsPages.main.language.bridge.sourceFixed", {
                            language: activeLanguageLabel,
                          })}
                        </p>
                        <p>{t("settingsPages.main.language.bridge.targetFixed")}</p>
                      </div>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={bridgeModeEnabled}
                  onClick={() => void handleBridgeModeToggle(!bridgeModeEnabled)}
                  disabled={bridgeModeSaving || preferenceSaving}
                  className={`relative h-7 w-14 rounded-full border transition ${
                    bridgeModeEnabled
                      ? "border-[rgba(91,174,138,0.4)] bg-[rgba(91,174,138,0.22)]"
                      : "border-white/12 bg-white/[0.05]"
                  } disabled:opacity-60`}
                >
                  <span className="sr-only">{t("settingsPages.main.language.bridge.toggle")}</span>
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.12)] transition ${
                      bridgeModeEnabled ? "left-8" : "left-1"
                    }`}
                  />
                </button>
              </div>
              {bridgeModeMessage ? (
                <p className="mt-3 text-[12px] text-white/55">{bridgeModeMessage}</p>
              ) : null}
            </div>
          ) : null}
          {preferenceMessage ? <p className="text-[13px] text-white/55">{preferenceMessage}</p> : null}
        </div>
      </section>

      <section className={settingsCardClass}>
        <SectionLabel>{t("settingsPages.main.studioDefaults.section")}</SectionLabel>
        <div className="mt-5 space-y-3">
          <FieldLabel>{t("settingsPages.main.studioDefaults.defaultStudio")}</FieldLabel>
          <DropdownSelect
            value={defaultStudio || ""}
            onChange={(value) => void handleDefaultStudioChange(value)}
            options={defaultStudioOptions}
            disabled={preferenceSaving}
          />
          <p className="text-[12px] text-white/35">
            {t("settingsPages.main.studioDefaults.blankBehavior")}
          </p>
          <p className="text-[12px] text-white/35">
            {t("settingsPages.main.studioDefaults.scope")}
          </p>
        </div>
      </section>

      <section className={`${settingsCardClass} opacity-75`}>
        <SectionLabel>{t("settingsPages.main.notifications.section")}</SectionLabel>
        <div className="mt-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-[Georgia] text-[14px] text-[#e8e4dc]">{t("settingsPages.main.notifications.emailTitle")}</p>
            <p className="mt-2 text-[12px] text-white/35">
              {t("settingsPages.main.notifications.comingSoon")}
            </p>
          </div>
          <button
            type="button"
            disabled
            className="relative h-7 w-12 rounded-full border border-white/10 bg-white/[0.03] opacity-60"
            aria-label={t("settingsPages.main.notifications.aria")}
          >
            <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white/20" />
          </button>
        </div>
      </section>

      <section className={settingsCardClass}>
        <SectionLabel>{t("settingsPages.main.dataPrivacy.section")}</SectionLabel>
        <div className="mt-5 space-y-5">
          <div>
            <p className="font-[Georgia] text-[14px] text-[#e8e4dc]">{t("settingsPages.main.dataPrivacy.exportTitle")}</p>
            <button
              type="button"
              onClick={() => setExportMessage(t("settingsPages.main.dataPrivacy.exportSuccess"))}
              className={`mt-3 ${settingsPrimaryButtonClass}`}
            >
              {t("settingsPages.main.dataPrivacy.exportAction")}
            </button>
            {exportMessage ? <p className="mt-3 text-[13px] text-[#9adbc0]">{exportMessage}</p> : null}
          </div>

          <div className="text-[13px] text-white/55">
            <p className="font-[Georgia] text-[14px] text-[#e8e4dc]">{t("settingsPages.main.dataPrivacy.browserExtensionTitle")}</p>
            <p className="mt-2">
              {extensionStatus === "checking"
                ? t("settingsPages.main.dataPrivacy.extensionChecking")
                : extensionStatus === "active"
                  ? t("settingsPages.main.dataPrivacy.extensionActive")
                  : t("settingsPages.main.dataPrivacy.extensionInactive")}
            </p>
            {extensionStatus === "active" ? (
              <Link href="/mirror-mode/dashboard?tab=identity" className="mt-2 inline-block text-[#a0aed4] underline underline-offset-4">
                {t("settingsPages.main.dataPrivacy.openMirrorIdentity")}
              </Link>
            ) : null}
          </div>

          <div className="text-[13px] text-white/55">
            <p className="font-[Georgia] text-[14px] text-[#e8e4dc]">{t("settingsPages.main.dataPrivacy.voiceDataTitle")}</p>
            <p className="mt-2">{t("settingsPages.main.dataPrivacy.voiceDataBody")}</p>
            <Link href="/mirror-mode/dashboard?tab=identity" className="mt-2 inline-block text-[#a0aed4] underline underline-offset-4">
              {t("settingsPages.main.dataPrivacy.openMirrorIdentity")}
            </Link>
          </div>

          <div>
            <p className="font-[Georgia] text-[14px] text-[#e8e4dc]">{t("settingsPages.main.dataPrivacy.deleteTitle")}</p>
            {!deleteConfirming ? (
              <button
                type="button"
                onClick={() => {
                  setDeleteMessage(null);
                  setDeleteConfirming(true);
                }}
                className={`mt-3 ${settingsDestructiveButtonClass}`}
              >
                {t("settingsPages.main.dataPrivacy.deleteAction")}
              </button>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-[13px] text-[#c4847a]">
                  {t("settingsPages.main.dataPrivacy.deleteWarning")}
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirming(false)}
                    className={settingsPrimaryButtonClass}
                  >
                    {t("global.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirming(false);
                      setDeleteMessage(t("settingsPages.main.dataPrivacy.deleteSuccess"));
                    }}
                    className={settingsDestructiveButtonClass}
                  >
                    {t("settingsPages.main.dataPrivacy.deleteConfirm")}
                  </button>
                </div>
              </div>
            )}
            {deleteMessage ? <p className="mt-3 text-[13px] text-[#c4847a]">{deleteMessage}</p> : null}
          </div>
        </div>
      </section>

      <section className={`${settingsCardClass} opacity-75`}>
        <SectionLabel>{t("settingsPages.main.subscription.section")}</SectionLabel>
        <div className="mt-5 grid grid-cols-[140px_1fr] gap-3 text-[13px]">
          <span className="font-mono uppercase tracking-[0.1em] text-white/35">{t("settingsPages.main.subscription.currentPlan")}</span>
          <div>
            <p className="font-[Georgia] text-[14px] text-[#e8e4dc]">{t("settingsPages.main.subscription.planName")}</p>
            <p className="mt-1 text-white/35">{t("settingsPages.main.subscription.planBody")}</p>
          </div>
        </div>
      </section>
    </SettingsPageShell>
  );
}
