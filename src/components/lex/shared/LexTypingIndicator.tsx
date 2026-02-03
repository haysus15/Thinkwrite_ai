// src/components/lex/shared/LexTypingIndicator.tsx
"use client";

import React from "react";

export default function LexTypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="backdrop-blur-sm bg-white/10 border border-white/20 px-6 py-4 rounded-3xl">
        <div className="flex items-center space-x-3">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-[#EAAA00] rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-[#EAAA00] rounded-full animate-bounce delay-100" />
            <div className="w-2 h-2 bg-[#EAAA00] rounded-full animate-bounce delay-200" />
          </div>
          <p className="text-sm text-blue-100">Lex is thinking...</p>
        </div>
      </div>
    </div>
  );
}