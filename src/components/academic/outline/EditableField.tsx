"use client";

import { useEffect, useState } from "react";

interface EditableFieldProps {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  multiline?: boolean;
  className?: string;
}

export function EditableField({
  value,
  placeholder,
  onChange,
  onEditStart,
  onEditEnd,
  multiline = false,
  className = "",
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value);
    }
  }, [value, isEditing]);

  function startEditing() {
    setIsEditing(true);
    onEditStart?.();
  }

  function finishEditing() {
    setIsEditing(false);
    onEditEnd?.();
    onChange(localValue);
  }

  function cancelEditing() {
    setLocalValue(value);
    setIsEditing(false);
    onEditEnd?.();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (!multiline && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
  }

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={localValue}
          onChange={(event) => setLocalValue(event.target.value)}
          onBlur={finishEditing}
          onKeyDown={handleKeyDown}
          className={`w-full rounded bg-white/[0.08] px-1.5 py-1 text-base leading-7 text-slate-100 shadow-[inset_0_0_0_1.5px_rgba(99,102,241,0.6)] outline-none transition-all duration-150 placeholder:text-transparent ${className}`}
          style={{ fontSize: "16px" }}
        />
      );
    }

    return (
      <input
        autoFocus
        type="text"
        value={localValue}
        onChange={(event) => setLocalValue(event.target.value)}
        onBlur={finishEditing}
        onKeyDown={handleKeyDown}
        className={`w-full rounded bg-white/[0.08] px-1.5 py-1 text-base leading-7 text-slate-100 shadow-[inset_0_0_0_1.5px_rgba(99,102,241,0.6)] outline-none transition-all duration-150 placeholder:text-transparent ${className}`}
        style={{ fontSize: "16px" }}
      />
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={startEditing}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          startEditing();
        }
      }}
      className={`w-full cursor-text rounded px-1.5 py-1 text-left transition-all duration-150 hover:bg-white/[0.05] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] focus-visible:bg-white/[0.05] focus-visible:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] focus-visible:outline-none ${!value ? "opacity-50" : ""} ${className}`}
    >
      {value ? (
        value
      ) : (
        <span className="italic text-white/35">{placeholder}</span>
      )}
    </div>
  );
}
