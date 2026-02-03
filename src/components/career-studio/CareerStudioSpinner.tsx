"use client";

interface CareerStudioSpinnerProps {
  label?: string;
  sizeClassName?: string;
  className?: string;
}

export default function CareerStudioSpinner({
  label = "Loading...",
  sizeClassName = "w-6 h-6",
  className,
}: CareerStudioSpinnerProps) {
  const containerClasses = ["text-center text-white", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClasses}>
      <div
        className={`${sizeClassName} border-2 border-[#9333EA]/30 border-t-[#9333EA] rounded-full animate-spin mx-auto mb-3`}
      />
      <p className="text-white/50 text-sm">{label}</p>
    </div>
  );
}
