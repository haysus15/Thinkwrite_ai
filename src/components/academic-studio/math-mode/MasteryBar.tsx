"use client";

export default function MasteryBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-slate-300">{label}</p>
      <div className="h-2 w-full rounded-full bg-slate-800/80">
        <div
          className="h-2 rounded-full bg-sky-400/80"
          style={{ width: `${safeValue}%` }}
        />
      </div>
      <p className="text-[11px] text-slate-400">Your current level with this concept</p>
    </div>
  );
}
