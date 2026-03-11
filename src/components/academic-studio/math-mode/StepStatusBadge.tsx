"use client";

import { AlertTriangle, CheckCircle2, Circle, XCircle } from "lucide-react";
import type { StepStatus } from "@/types/math-mode";

const STATUS_META: Record<
  StepStatus,
  { label: string; icon: typeof Circle; color: string }
> = {
  unchecked: { label: "Unchecked", icon: Circle, color: "text-slate-500" },
  correct: { label: "Correct", icon: CheckCircle2, color: "text-emerald-700" },
  equivalent_form: {
    label: "Equivalent",
    icon: CheckCircle2,
    color: "text-emerald-600",
  },
  likely_correct: {
    label: "Likely Correct",
    icon: AlertTriangle,
    color: "text-teal-700",
  },
  incorrect: { label: "Incorrect", icon: XCircle, color: "text-red-700" },
  needs_recheck: {
    label: "Needs Recheck",
    icon: AlertTriangle,
    color: "text-amber-700",
  },
  error: { label: "Incorrect", icon: XCircle, color: "text-red-700" },
  partial: { label: "Partial", icon: AlertTriangle, color: "text-amber-700" },
};

export default function StepStatusBadge({ status }: { status: StepStatus }) {
  const meta = STATUS_META[status] || STATUS_META.unchecked;
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <Icon className={`h-4 w-4 ${meta.color}`} />
      <span className="text-slate-700">{meta.label}</span>
    </span>
  );
}
