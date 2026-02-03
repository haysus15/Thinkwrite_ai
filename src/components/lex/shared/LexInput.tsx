// src/components/lex/shared/LexInput.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";

interface LexInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function LexInput({
  onSend,
  placeholder = "Type your career question...",
  disabled = false,
}: LexInputProps) {
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  const handleSend = () => {
    if (!inputValue.trim() || disabled) return;
    onSend(inputValue);
    setInputValue("");
    
    // Reset textarea height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Allow Shift+Enter for new line
  };

  return (
    <div className="flex gap-4 items-end">
      {/* Textarea Container */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full px-6 py-4 bg-white/5 border border-white/20 rounded-2xl text-white placeholder-blue-200 focus:outline-none focus:border-[#EAAA00] transition-all resize-none overflow-hidden min-h-[56px] max-h-[200px]"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#EAAA00 transparent',
          }}
        />
        
        {/* Character count (optional) */}
        {inputValue.length > 0 && (
          <div className="absolute bottom-2 right-4 text-[10px] text-white/30">
            {inputValue.length} chars
          </div>
        )}
      </div>

      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={!inputValue.trim() || disabled}
        className="px-8 py-4 h-[56px] bg-[#EAAA00] text-black rounded-2xl hover:bg-[#d89b00] disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-[0_0_25px_rgba(234,170,0,0.4)] flex-shrink-0"
      >
        Send
      </button>
    </div>
  );
}