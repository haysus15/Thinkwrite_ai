// src/components/lex/shared/LexMessage.tsx
"use client";

import React from "react";
import { Message } from "../types/lex.types";

interface LexMessageProps {
  message: Message;
}

export default function LexMessage({ message }: LexMessageProps) {
  return (
    <div
      className={`flex ${
        message.sender === "user" ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-2xl px-6 py-4 rounded-3xl shadow-2xl backdrop-blur-sm ${
          message.sender === "user"
            ? "bg-gradient-to-br from-[#EAAA00]/90 to-amber-500/90 text-black"
            : "bg-white/5 text-white border border-white/15"
        }`}
      >
        {/* Match Context Badge */}
        {message.matchContext && (
          <div className="mb-3 px-3 py-2 bg-pink-500/15 rounded-lg border border-pink-400/30">
            <div className="flex items-center space-x-2 text-xs text-pink-100">
              <span>Match: {message.matchContext.matchScore}/100</span>
            </div>
          </div>
        )}

        {/* Tailored Resume Context Badge */}
        {message.tailoredResumeContext && !message.matchContext && (
          <div className="mb-3 px-3 py-2 bg-purple-500/15 rounded-lg border border-purple-400/30">
            <div className="flex items-center space-x-2 text-xs text-purple-100">
              <span>
                Tailoring: {message.tailoredResumeContext.jobTitle} •{" "}
                {message.tailoredResumeContext.changesCount} changes
              </span>
            </div>
          </div>
        )}

        {/* Job Context Badge */}
        {message.jobContext &&
          !message.tailoredResumeContext &&
          !message.matchContext && (
            <div className="mb-3 px-3 py-2 bg-[#EAAA00]/10 rounded-lg border border-[#EAAA00]/40">
              <div className="flex items-center space-x-2 text-xs text-[#FDE68A]">
                <span>
                  {message.jobContext.jobTitle} at {message.jobContext.company}
                </span>
              </div>
            </div>
          )}

        {/* Message Text */}
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.text}
        </p>

        {/* Timestamp */}
        <p
          className={`text-xs mt-3 ${
            message.sender === "user" ? "text-black/70" : "text-blue-200/80"
          }`}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}