"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface DropdownSelectOption {
  value: string;
  label: string;
}

interface DropdownSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: DropdownSelectOption[];
  disabled?: boolean;
  className?: string;
}

export default function DropdownSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
  className = "",
}: DropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label ? (
        <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">{label}</span>
      ) : null}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (!disabled) {
            setOpen((current) => !current);
          }
        }}
        className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm text-white outline-none transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span>{selectedOption?.label ?? ""}</span>
        <ChevronDown className={`h-4 w-4 text-white/55 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[120] max-h-64 overflow-auto rounded-xl border border-white/12 bg-[#141923] p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-md"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition ${
                  isSelected
                    ? "bg-[rgba(91,110,174,0.24)] text-[#dbe5ff]"
                    : "text-white/80 hover:bg-white/[0.06]"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
