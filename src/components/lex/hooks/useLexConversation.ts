// src/components/lex/hooks/useLexConversation.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { Message, SessionType, ResumeContext } from "../types/lex.types";

interface UseLexConversationProps {
  sessionType: SessionType;
  welcomeMessage: string;
  resumeContext?: ResumeContext; // Master resume - ALWAYS passed when available
  strategyModeData?: any; // For resume tailoring and cover letter modes
  jobContext?: any; // For job discussion mode
  matchContext?: any; // For match analysis mode
  tailoredResumeContext?: any; // For tailored resume discussions
}

/**
 * useLexConversation Hook
 * 
 * Manages conversation state and API communication with Lex.
 * Ensures proper context and session boundaries are maintained.
 * 
 * @param sessionType - Type of Lex session (determines boundaries)
 * @param welcomeMessage - Initial greeting from Lex
 * @param resumeContext - Master resume (always available)
 * @param strategyModeData - Resume/job content for strategy sessions
 * @param jobContext - Job analysis data
 * @param matchContext - Resume-job match data
 * @param tailoredResumeContext - Tailored resume data
 */
export function useLexConversation({
  sessionType,
  welcomeMessage,
  resumeContext,
  strategyModeData,
  jobContext,
  matchContext,
  tailoredResumeContext,
}: UseLexConversationProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Initialize conversation with welcome message
  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        text: welcomeMessage,
        sender: "lex",
        timestamp: new Date(),
      },
    ]);
  }, [welcomeMessage]);

  // Send message to Lex and handle response
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Add user message to conversation
      const userMessage: Message = {
        id: "user-" + Date.now(),
        text,
        sender: "user",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);

      try {
        // Call Lex API with full context
        const response = await fetch("/api/lex/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Conversation history
            messages: [
              ...messages,
              {
                sender: "user",
                text,
                timestamp: new Date().toISOString(),
              },
            ],

            // Session identification
            sessionType, // Determines boundaries in API

            // Session type flag
            isStrategySession: sessionType !== "general",

            // Always include resume context if available
            resumeContext: resumeContext?.hasResume ? resumeContext : undefined,

            // Optional context based on session type
            strategyModeData, // For resume-tailoring & cover-letter modes
            jobContext, // For job-discussion mode
            matchContext, // For match-analysis mode
            tailoredResumeContext, // For tailored resume discussions
          }),
        });

        const data = await response.json();

        if (data.success && data.response) {
          // Add Lex's response to conversation
          const lexMessage: Message = {
            id: "lex-" + Date.now(),
            text: data.response.text,
            sender: "lex",
            timestamp: new Date(),
          };

          setMessages((prev) => [...prev, lexMessage]);
        } else {
          throw new Error(data.error || "Failed to get response");
        }
      } catch (error) {
        console.error("Lex API error:", error);

        // Add error message to conversation
        const errorMessage: Message = {
          id: "lex-error-" + Date.now(),
          text: "Tech issue on my end. What were you asking? I can still help.",
          sender: "lex",
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsTyping(false);
      }
    },
    [
      sessionType,
      messages,
      resumeContext,
      strategyModeData,
      jobContext,
      matchContext,
      tailoredResumeContext,
    ]
  );

  return {
    messages, // Current conversation history
    isTyping, // Whether Lex is typing
    sendMessage, // Function to send new message
    setMessages, // Function to update messages (for loading saved conversations)
  };
}
