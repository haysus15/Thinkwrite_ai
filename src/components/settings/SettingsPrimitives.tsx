import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import SettingsCosmicBackground from "@/components/settings/SettingsCosmicBackground";

export const settingsCardClass =
  "rounded-[14px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm";

export const settingsInputClass =
  "w-full rounded-[8px] border border-white/[0.12] bg-white/[0.05] px-[14px] py-[11px] text-[14px] text-[#e8e4dc] outline-none transition placeholder:text-white/25 focus:border-[rgba(160,174,212,0.45)]";

export const settingsDisabledInputClass =
  "w-full rounded-[8px] border border-white/[0.07] bg-white/[0.02] px-[14px] py-[11px] text-[14px] text-white/30 outline-none";

export const settingsPrimaryButtonClass =
  "rounded-[8px] border border-[rgba(91,110,174,0.4)] bg-[rgba(91,110,174,0.2)] px-5 py-2.5 text-[13px] text-[#a0aed4] transition hover:bg-[rgba(91,110,174,0.26)] disabled:cursor-not-allowed disabled:opacity-50";

export const settingsDestructiveButtonClass =
  "rounded-[8px] border border-[rgba(174,91,91,0.25)] bg-[rgba(174,91,91,0.1)] px-5 py-2.5 text-[13px] text-[#c4847a] transition hover:bg-[rgba(174,91,91,0.16)] disabled:cursor-not-allowed disabled:opacity-50";

export function SettingsPageShell({
  title,
  subtitle,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  subtitle: string;
  backHref: string;
  backLabel: string;
  children: ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-x-hidden overflow-y-visible px-6 py-10 text-[#e8e4dc]">
      <SettingsCosmicBackground />
      <div className="relative z-10 mx-auto max-w-[620px]">
        <Link
          href={backHref}
          className="mb-8 inline-flex items-center gap-2 text-[13px] text-[#9e9a8e] transition hover:text-[#d8d2c7]"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{backLabel}</span>
        </Link>

        <div className="mb-6">
          <h1 className="font-[Georgia] text-[26px] font-normal text-[#f0ece4]">{title}</h1>
          <p className="mt-2 text-[13px] text-white/35">{subtitle}</p>
          <div className="mt-5 h-px bg-gradient-to-r from-white/10 to-transparent" />
        </div>

        <div className="space-y-5">{children}</div>
      </div>
    </main>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
      {children}
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block font-mono text-[10px] uppercase tracking-[0.1em] text-white/45">
      {children}
    </label>
  );
}
