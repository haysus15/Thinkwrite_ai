"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ParsedCodeChallenge } from "@/lib/code-review/challengeParser";

export default function ChallengeParseReview({
  initialChallenges,
  onConfirm,
  onBack,
  isSaving,
}: {
  initialChallenges: ParsedCodeChallenge[];
  onConfirm: (challenges: ParsedCodeChallenge[]) => void;
  onBack: () => void;
  isSaving?: boolean;
}) {
  const t = useTranslations("academic.codeReviewMode.parseReview");
  const [challenges, setChallenges] = useState<ParsedCodeChallenge[]>(initialChallenges);

  const normalized = useMemo(
    () =>
      challenges.map((challenge, index) => ({
        ...challenge,
        order: index + 1,
      })),
    [challenges]
  );

  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <header>
        <h3 className="text-sm font-medium text-slate-100">{t("title")}</h3>
        <p className="mt-1 text-xs text-slate-400">
          {t("subtitle")}
        </p>
      </header>

      <div className="space-y-2">
        {normalized.map((challenge, index) => (
          <div key={`${challenge.order}-${index}`} className="rounded-lg border border-white/10 p-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-300">#{index + 1}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setChallenges((prev) => {
                      if (index === 0) return prev;
                      const next = [...prev];
                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                      return next;
                    })
                  }
                  className="rounded border border-white/20 px-1.5 py-0.5 text-[11px] text-slate-200"
                >
                  {t("up")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setChallenges((prev) => {
                      if (index === prev.length - 1) return prev;
                      const next = [...prev];
                      [next[index + 1], next[index]] = [next[index], next[index + 1]];
                      return next;
                    })
                  }
                  className="rounded border border-white/20 px-1.5 py-0.5 text-[11px] text-slate-200"
                >
                  {t("down")}
                </button>
                <button
                  type="button"
                  onClick={() => setChallenges((prev) => prev.filter((_, idx) => idx !== index))}
                  className="rounded border border-rose-300/30 px-1.5 py-0.5 text-[11px] text-rose-100"
                >
                  {t("delete")}
                </button>
              </div>
            </div>
            <textarea
              value={challenge.raw_text}
              onChange={(event) =>
                setChallenges((prev) =>
                  prev.map((row, idx) =>
                    idx === index ? { ...row, raw_text: event.target.value } : row
                  )
                )
              }
              rows={3}
              className="w-full rounded border border-white/20 bg-slate-950/30 p-2 text-xs text-slate-100"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          setChallenges((prev) => [
            ...prev,
            {
              order: prev.length + 1,
              raw_text: "",
              challenge_type: "other",
              language_hint: null,
            },
          ])
        }
        className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-slate-200"
      >
        {t("addChallenge")}
      </button>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-slate-200"
        >
          {t("back")}
        </button>
        <button
          type="button"
          disabled={Boolean(isSaving) || normalized.length === 0}
          onClick={() => onConfirm(normalized)}
          className="rounded-full border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs text-sky-100 disabled:opacity-60"
        >
          {isSaving ? t("saving") : t("confirm")}
        </button>
      </div>
    </section>
  );
}
