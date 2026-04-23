"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import AcademicLoadingState from "../shared/AcademicLoadingState";

interface MirrorModeCheckProps {
  userId: string;
  assignmentDueDate: string | null;
  onProceed: (voiceApplied: boolean) => void;
  onAddSamples: () => void;
}

function isDeadlineSituation(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const hoursUntilDue = (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursUntilDue <= 6;
}

function ScreenCard({
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  primaryFirst = true,
  footer,
}: {
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  primaryFirst?: boolean;
  footer?: string;
}) {
  const buttons = [
    primaryFirst ? (
      <button
        key="primary"
        type="button"
        onClick={onPrimary}
        className="rounded-full border border-sky-400/40 bg-sky-500/15 px-5 py-2.5 text-sm text-sky-100"
      >
        {primaryLabel}
      </button>
    ) : null,
    secondaryLabel && onSecondary ? (
      <button
        key="secondary"
        type="button"
        onClick={onSecondary}
        className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-slate-100"
      >
        {secondaryLabel}
      </button>
    ) : null,
    !primaryFirst ? (
      <button
        key="primary-last"
        type="button"
        onClick={onPrimary}
        className="rounded-full border border-sky-400/40 bg-sky-500/15 px-5 py-2.5 text-sm text-sky-100"
      >
        {primaryLabel}
      </button>
    ) : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-slate-950/50 p-8 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Mirror Mode check</p>
      <h2 className="mt-4 text-2xl font-semibold text-slate-100">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-300">{body}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{buttons}</div>
      {footer ? <p className="mx-auto mt-4 max-w-lg text-xs text-slate-400">{footer}</p> : null}
    </div>
  );
}

export default function MirrorModeCheck({
  userId,
  assignmentDueDate,
  onProceed,
  onAddSamples,
}: MirrorModeCheckProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void supabase
      .from("voice_chambers")
      .select("confidence_level")
      .eq("user_id", userId)
      .eq("chamber", "academic")
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setConfidence(Number(data?.confidence_level ?? 0));
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setConfidence(0);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [supabase, userId]);

  if (loading) {
    return <AcademicLoadingState message="Checking your writing style..." />;
  }

  const isDeadline = isDeadlineSituation(assignmentDueDate);

  if (isDeadline) {
    return (
      <ScreenCard
        title="Mirror Mode deadline bypass"
        body=""
        primaryLabel="Generate my paper →"
        onPrimary={() => onProceed(false)}
        footer="Mirror Mode not active for this paper. Add writing samples after you submit to use it next time."
      />
    );
  }

  if ((confidence ?? 0) >= 30) {
    return (
      <ScreenCard
        title="Mirror Mode is active"
        body="Your academic writing style is loaded. This paper will sound like you."
        primaryLabel="Generate my paper →"
        onPrimary={() => onProceed(true)}
      />
    );
  }

  if ((confidence ?? 0) > 0) {
    return (
      <ScreenCard
        title="Mirror Mode has some of your writing"
        body="We have samples but not enough to fully match your style. Your paper will sound close to you but may not be exact."
        primaryLabel="Generate with current voice →"
        onPrimary={() => onProceed(true)}
        secondaryLabel="Add writing samples"
        onSecondary={onAddSamples}
      />
    );
  }

  return (
    <ScreenCard
      title="Mirror Mode is not active"
      body="Your paper will be written in clear academic prose. It won't specifically sound like you yet."
      primaryLabel="Generate without my voice →"
      onPrimary={() => onProceed(false)}
      secondaryLabel="Upload a writing sample"
      onSecondary={onAddSamples}
    />
  );
}
