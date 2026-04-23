"use client";

type CrossLanguageNoticeProps = {
  notice: string | null | undefined;
  profileVersion?: 1 | 2 | null;
  className?: string;
};

export default function CrossLanguageNotice({
  notice,
  profileVersion,
  className = "",
}: CrossLanguageNoticeProps) {
  if (!notice || (profileVersion !== 1 && profileVersion !== 2)) {
    return null;
  }

  const toneClass =
    profileVersion === 1
      ? "border-sky-400/20 bg-sky-500/10 text-sky-100"
      : "border-amber-400/20 bg-amber-500/10 text-amber-100";

  return (
    <div
      className={`rounded-xl border px-3 py-2 text-xs leading-5 ${toneClass} ${className}`.trim()}
    >
      {notice}
    </div>
  );
}
