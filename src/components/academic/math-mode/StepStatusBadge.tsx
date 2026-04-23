"use client";

import { AlertTriangle, CheckCircle2, Circle, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { StepStatus } from "@/types/math-mode";

export default function StepStatusBadge({ status }: { status: StepStatus }) {
  const t = useTranslations();
  const STATUS_META: Record<
    StepStatus,
    { label: string; icon: typeof Circle; color: string }
  > = {
    unchecked: { label: t("academic.mathMode.badges.unchecked"), icon: Circle, color: "text-slate-500" },
    correct: { label: t("academic.mathMode.badges.correct"), icon: CheckCircle2, color: "text-emerald-700" },
    equivalent_form: {
      label: t("academic.mathMode.badges.equivalent"),
      icon: CheckCircle2,
      color: "text-emerald-600",
    },
    likely_correct: {
      label: t("academic.mathMode.badges.likelyCorrect"),
      icon: AlertTriangle,
      color: "text-teal-700",
    },
    incorrect: { label: t("academic.mathMode.badges.incorrect"), icon: XCircle, color: "text-red-700" },
    needs_recheck: {
      label: t("academic.mathMode.badges.needsRecheck"),
      icon: AlertTriangle,
      color: "text-amber-700",
    },
    error: { label: t("academic.mathMode.badges.incorrect"), icon: XCircle, color: "text-red-700" },
    partial: { label: t("academic.mathMode.badges.partial"), icon: AlertTriangle, color: "text-amber-700" },
  };
  const meta = STATUS_META[status] || STATUS_META.unchecked;
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <Icon className={`h-4 w-4 ${meta.color}`} />
      <span className="text-slate-700">{meta.label}</span>
    </span>
  );
}
