"use client";

import type { CoachingProfile } from "@/lib/academic/victor/coachingProfiles";
import { COACHING_PROFILE_DESCRIPTIONS } from "@/lib/academic/victor/coachingProfiles";

type VictorProfileSelectorProps = {
  activeProfile: CoachingProfile;
  onSelect: (profile: CoachingProfile) => void;
  loading?: boolean;
};

const profiles: Array<{ id: CoachingProfile; label: string }> = [
  { id: "tutor", label: "Tutor" },
  { id: "critic", label: "Critic" },
  { id: "exam_prep", label: "Exam Prep" },
  { id: "fast_review", label: "Fast Review" },
];

export default function VictorProfileSelector({
  activeProfile,
  onSelect,
  loading = false,
}: VictorProfileSelectorProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
      <div className="grid grid-cols-4 gap-1 text-[11px]">
        {profiles.map((profile) => {
          const active = profile.id === activeProfile;
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onSelect(profile.id)}
              disabled={loading}
              className={`rounded-md px-2 py-1.5 transition ${
                active
                  ? "bg-sky-500/20 text-sky-100"
                  : "text-slate-300 hover:bg-white/10"
              }`}
            >
              {profile.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        {COACHING_PROFILE_DESCRIPTIONS[activeProfile]}
      </p>
    </div>
  );
}
