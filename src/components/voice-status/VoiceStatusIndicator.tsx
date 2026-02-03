// src/components/voice-status/VoiceStatusIndicator.tsx
// Visual indicator showing voice profile status in Career Studio

"use client";

import { useVoiceProfile } from "@/hooks/useVoiceProfile";
import type { ConfidenceTier } from "@/services/voice-profile/VoiceProfileService";
import Link from "next/link";

// ============================================================================
// TYPES
// ============================================================================

interface VoiceStatusIndicatorProps {
  variant?: "compact" | "full" | "minimal";
  showLink?: boolean;
  className?: string;
}

// ============================================================================
// TIER STYLING
// ============================================================================

const tierColors: Record<ConfidenceTier, { bg: string; text: string; border: string; glow: string }> = {
  none: {
    bg: "bg-zinc-800/50",
    text: "text-zinc-400",
    border: "border-zinc-700",
    glow: "",
  },
  developing: {
    bg: "bg-amber-900/20",
    text: "text-amber-400",
    border: "border-amber-800/50",
    glow: "",
  },
  emerging: {
    bg: "bg-blue-900/20",
    text: "text-blue-400",
    border: "border-blue-800/50",
    glow: "",
  },
  established: {
    bg: "bg-emerald-900/20",
    text: "text-emerald-400",
    border: "border-emerald-800/50",
    glow: "shadow-emerald-500/10",
  },
  strong: {
    bg: "bg-violet-900/20",
    text: "text-violet-400",
    border: "border-violet-800/50",
    glow: "shadow-violet-500/20 shadow-lg",
  },
};

const tierLabels: Record<ConfidenceTier, string> = {
  none: "No Voice Profile",
  developing: "Learning Your Voice",
  emerging: "Emerging Voice",
  established: "Established Voice",
  strong: "Authentic Voice",
};

const tierIcons: Record<ConfidenceTier, string> = {
  none: "○",      // Empty circle
  developing: "◔", // Quarter filled
  emerging: "◑",   // Half filled
  established: "◕", // Three-quarter filled
  strong: "●",     // Full circle
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function VoiceStatusIndicator({
  variant = "compact",
  showLink = true,
  className = "",
}: VoiceStatusIndicatorProps) {
  const { isLoading, readiness, hasProfile } = useVoiceProfile({
    studioType: "career",
  });

  if (isLoading) {
    return <LoadingState variant={variant} className={className} />;
  }

  const tier = readiness?.tier ?? "none";
  const score = readiness?.score ?? 0;
  const colors = tierColors[tier];

  if (variant === "minimal") {
    return (
      <MinimalIndicator
        tier={tier}
        score={score}
        colors={colors}
        className={className}
      />
    );
  }

  if (variant === "compact") {
    return (
      <CompactIndicator
        tier={tier}
        score={score}
        colors={colors}
        showLink={showLink}
        className={className}
      />
    );
  }

  return (
    <FullIndicator
      tier={tier}
      score={score}
      readiness={readiness}
      colors={colors}
      showLink={showLink}
      hasProfile={hasProfile}
      className={className}
    />
  );
}

// ============================================================================
// VARIANT COMPONENTS
// ============================================================================

function LoadingState({
  variant,
  className,
}: {
  variant: string;
  className: string;
}) {
  if (variant === "minimal") {
    return (
      <div className={`w-3 h-3 rounded-full bg-zinc-700 animate-pulse ${className}`} />
    );
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700 ${className}`}
    >
      <div className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse" />
      <span className="text-xs text-zinc-500">Loading voice...</span>
    </div>
  );
}

function MinimalIndicator({
  tier,
  score,
  colors,
  className,
}: {
  tier: ConfidenceTier;
  score: number;
  colors: typeof tierColors.none;
  className: string;
}) {
  return (
    <div
      className={`relative group ${className}`}
      title={`${tierLabels[tier]} (${score}%)`}
    >
      <span className={`text-sm ${colors.text}`}>{tierIcons[tier]}</span>
      
      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {tierLabels[tier]} ({score}%)
      </div>
    </div>
  );
}

function CompactIndicator({
  tier,
  score,
  colors,
  showLink,
  className,
}: {
  tier: ConfidenceTier;
  score: number;
  colors: typeof tierColors.none;
  showLink: boolean;
  className: string;
}) {
  const content = (
    <div
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-lg
        ${colors.bg} ${colors.border} border
        ${colors.glow}
        transition-all duration-200
        ${showLink ? "hover:scale-[1.02] cursor-pointer" : ""}
        ${className}
      `}
    >
      <span className={`text-sm ${colors.text}`}>{tierIcons[tier]}</span>
      <span className={`text-xs font-medium ${colors.text}`}>
        {tier === "none" ? "No Voice" : `${score}%`}
      </span>
    </div>
  );

  if (showLink && tier === "none") {
    return (
      <Link href="/mirror-mode" className="no-underline">
        {content}
      </Link>
    );
  }

  return content;
}

function FullIndicator({
  tier,
  score,
  readiness,
  colors,
  showLink,
  hasProfile,
  className,
}: {
  tier: ConfidenceTier;
  score: number;
  readiness: any;
  colors: typeof tierColors.none;
  showLink: boolean;
  hasProfile: boolean;
  className: string;
}) {
  return (
    <div
      className={`
        rounded-xl p-4
        ${colors.bg} ${colors.border} border
        ${colors.glow}
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-lg ${colors.text}`}>{tierIcons[tier]}</span>
          <span className={`text-sm font-medium ${colors.text}`}>
            {tierLabels[tier]}
          </span>
        </div>
        {tier !== "none" && (
          <span className={`text-lg font-bold ${colors.text}`}>{score}%</span>
        )}
      </div>

      {/* Progress bar */}
      {tier !== "none" && (
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              tier === "strong"
                ? "bg-gradient-to-r from-violet-500 to-purple-400"
                : tier === "established"
                ? "bg-gradient-to-r from-emerald-500 to-green-400"
                : tier === "emerging"
                ? "bg-gradient-to-r from-blue-500 to-cyan-400"
                : "bg-gradient-to-r from-amber-500 to-yellow-400"
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
      )}

      {/* Message */}
      <p className="text-xs text-zinc-400 leading-relaxed">
        {readiness?.message}
      </p>

      {/* Action link */}
      {showLink && (readiness?.shouldEncourage || !hasProfile) && (
        <Link
          href="/mirror-mode"
          className={`
            inline-flex items-center gap-1 mt-3 text-xs font-medium
            ${colors.text} hover:underline
          `}
        >
          {hasProfile ? "Upload more documents" : "Set up Mirror Mode"}
          <span>→</span>
        </Link>
      )}
    </div>
  );
}

// ============================================================================
// CONFIDENCE BAR (standalone component)
// ============================================================================

export function VoiceConfidenceBar({
  score,
  showLabel = true,
  className = "",
}: {
  score: number;
  showLabel?: boolean;
  className?: string;
}) {
  const tier = getConfidenceTierFromScore(score);
  const colors = tierColors[tier];

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-zinc-500">Voice Confidence</span>
          <span className={`text-xs font-medium ${colors.text}`}>{score}%</span>
        </div>
      )}
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            tier === "strong"
              ? "bg-gradient-to-r from-violet-500 to-purple-400"
              : tier === "established"
              ? "bg-gradient-to-r from-emerald-500 to-green-400"
              : tier === "emerging"
              ? "bg-gradient-to-r from-blue-500 to-cyan-400"
              : tier === "developing"
              ? "bg-gradient-to-r from-amber-500 to-yellow-400"
              : "bg-zinc-700"
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function getConfidenceTierFromScore(score: number): ConfidenceTier {
  if (score === 0) return "none";
  if (score < 40) return "developing";
  if (score < 65) return "emerging";
  if (score < 85) return "established";
  return "strong";
}

// ============================================================================
// EXPORTS
// ============================================================================

export default VoiceStatusIndicator;