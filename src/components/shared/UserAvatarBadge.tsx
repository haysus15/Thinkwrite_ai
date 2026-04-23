"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { deriveAvatarColor, getInitials } from "@/lib/avatar";
import { getPersonaGreeting, type StudioPersona } from "@/lib/greetings";

interface UserAvatarBadgeProps {
  persona: StudioPersona;
}

function fallbackName(email: string | null | undefined): string {
  const prefix = email?.split("@")[0]?.trim();
  return prefix || "";
}

export default function UserAvatarBadge({ persona }: UserAvatarBadgeProps) {
  const t = useTranslations();
  const router = useRouter();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [greeting, setGreeting] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!profile && user?.id) {
      void refreshProfile();
    }
  }, [profile, refreshProfile, user?.id]);

  const displayName = useMemo(() => {
    const candidate = profile?.name?.trim() || fallbackName(profile?.email || user?.email);
    return candidate || "";
  }, [profile?.email, profile?.name, user?.email]);

  const avatarColor = useMemo(
    () => profile?.avatar_color || deriveAvatarColor(displayName),
    [displayName, profile?.avatar_color]
  );

  useEffect(() => {
    if (!displayName) {
      setGreeting(t("account.welcomeBack"));
      return;
    }
    setGreeting(getPersonaGreeting(persona, displayName));
  }, [persona, displayName, t]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    router.push("/");
  };

  const handleSettings = () => {
    setOpen(false);
    router.push("/settings");
  };

  return (
    <div ref={rootRef} className="relative z-[70] flex items-center gap-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-3 rounded-full transition-opacity hover:opacity-90"
        aria-label={t("account.openMenu")}
        aria-expanded={open}
      >
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold text-white"
          style={{ backgroundColor: avatarColor }}
        >
          {getInitials(displayName)}
        </span>
        <span className="hidden text-sm text-white/70 md:inline">{greeting}</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-[140] min-w-[210px] rounded-xl border border-white/12 bg-[#121826] p-2 text-sm text-white/85 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
          <button
            type="button"
            onClick={handleSettings}
            className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/5"
          >
            {t("account.accountSettings")}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/5"
          >
            {t("account.signOut")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
