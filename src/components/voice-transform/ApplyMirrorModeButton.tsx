"use client";

import { useState } from "react";
import { VoiceTransformModal } from "./VoiceTransformModal";

interface Props {
  content: string;
  contentType: string;
  onTransformed: (newContent: string) => void;
  className?: string;
}

export function ApplyMirrorModeButton({
  content,
  contentType,
  onTransformed,
  className = "",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`career-btn-secondary flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg ${className}`}
      >
        Apply Mirror Mode
      </button>

      {isOpen && (
        <VoiceTransformModal
          content={content}
          contentType={contentType}
          onClose={() => setIsOpen(false)}
          onTransformed={(newContent) => {
            onTransformed(newContent);
            setIsOpen(false);
          }}
        />
      )}
    </>
  );
}
