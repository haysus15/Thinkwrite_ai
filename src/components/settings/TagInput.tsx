"use client";

import { KeyboardEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  maxTags: number;
}

function normalizeTag(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export default function TagInput({
  value,
  onChange,
  placeholder,
  maxTags,
}: TagInputProps) {
  const t = useTranslations("shared.group11.tagInput");
  const [input, setInput] = useState("");

  const addTag = () => {
    const nextTag = normalizeTag(input);
    if (!nextTag || value.includes(nextTag) || value.length >= maxTags) return;
    onChange([...value, nextTag]);
    setInput("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTag();
    }
    if (event.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex min-h-[48px] flex-wrap gap-2 rounded-[8px] border border-white/10 bg-white/[0.05] px-3 py-3">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[13px] text-[#e8e4dc]"
          >
            <span>{tag}</span>
            <button
              type="button"
              onClick={() => onChange(value.filter((current) => current !== tag))}
              className="text-white/50 transition hover:text-white"
              aria-label={t("remove", { tag })}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={value.length >= maxTags ? t("maxTags", { maxTags }) : placeholder}
          disabled={value.length >= maxTags && !input}
          className="min-w-[180px] flex-1 bg-transparent text-[14px] text-[#e8e4dc] outline-none placeholder:text-white/25 disabled:cursor-not-allowed disabled:text-white/30"
        />
      </div>
      <p className="text-[12px] text-white/35">
        {t("count", { count: value.length, maxTags })}
      </p>
    </div>
  );
}
