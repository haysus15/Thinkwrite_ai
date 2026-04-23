"use client";

import Image from "next/image";
import Link from "next/link";
import { Settings } from "lucide-react";
import UserAvatarBadge from "@/components/shared/UserAvatarBadge";
import type { StudioPersona } from "@/lib/greetings";

interface StudioHeaderProps {
  studioName: string;
  persona: StudioPersona;
  settingsHref?: string;
}

export default function StudioHeader({
  studioName,
  persona,
  settingsHref,
}: StudioHeaderProps) {
  return (
    <div className="grid h-full w-full grid-cols-[auto_1fr_auto] items-center gap-4">
      <div className="flex min-w-0 items-center gap-5">
        <Link href="/select-studio" className="shrink-0 cursor-pointer">
          <Image
            src="/thinkwrite-logo-transparent.png"
            alt="THINKWRITE AI"
            width={180}
            height={28}
            className="h-auto w-auto max-h-5 transition-opacity hover:opacity-80"
            priority
          />
        </Link>
      </div>

      <div className="min-w-0 text-center">
        <span className="text-sm font-semibold text-slate-100 md:text-base">{studioName}</span>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-3">
        {settingsHref ? (
          <Link
            href={settingsHref}
            aria-label={`${studioName} settings`}
            className="text-white/50 transition hover:text-white/90"
          >
            <Settings className="h-4 w-4" />
          </Link>
        ) : null}
        <UserAvatarBadge persona={persona} />
      </div>
    </div>
  );
}
