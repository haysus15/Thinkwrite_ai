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
        className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-violet-400 hover:text-violet-300 bg-violet-900/20 hover:bg-violet-900/30 border border-violet-800/50 rounded-lg transition-colors ${className}`}
      >
        <span>✨</span>
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
