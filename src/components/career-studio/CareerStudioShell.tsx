"use client";

import type { ReactNode } from "react";

interface CareerStudioShellProps {
  children: ReactNode;
  showHeader?: boolean;
  contentClassName?: string;
  headerSlot?: ReactNode;
}

export default function CareerStudioShell({
  children,
  showHeader = true,
  contentClassName,
  headerSlot,
}: CareerStudioShellProps) {
  const contentClasses = [
    "career-panels-row",
    contentClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="career-studio-root font-['Orbitron']">
      <div className="career-sky-layer">
        <div className="career-stars-layer" />
        <div className="career-nebula-layer" />
        <div className="career-milky-way" />
        <div className="career-planets" />
        <div className="career-meteors" />
        <div className="career-shooting-star" />
      </div>

      <div className="career-content-layer">
        {showHeader && (
          <header className="career-global-header">
            <div className="career-header-mark">TW</div>
            <div className="career-header-title">ThinkWrite AI · Career Studio</div>
          </header>
        )}

        {headerSlot}

        <div className={contentClasses}>{children}</div>
      </div>
    </div>
  );
}
