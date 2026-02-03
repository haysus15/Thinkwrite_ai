// src/components/lex/hooks/useLexStorage.ts
"use client";

import { useCallback } from "react";
import { Message } from "../types/lex.types";

const LEX_STORAGE_KEY = "thinkwrite_lex_conversation";

interface UseLexStorageProps {
  sessionType?: string;
}

export function useLexStorage({ sessionType = "general" }: UseLexStorageProps) {
  // Save to localStorage
  const saveToLocalStorage = useCallback(
    (messages: Message[]) => {
      try {
        localStorage.setItem(
          LEX_STORAGE_KEY,
          JSON.stringify({
            messages,
            sessionType,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch (error) {
        console.error("Failed to save to localStorage:", error);
      }
    },
    [sessionType]
  );

  // Load from localStorage
  const loadFromLocalStorage = useCallback((): Message[] | null => {
    try {
      const saved = localStorage.getItem(LEX_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.messages && Array.isArray(parsed.messages)) {
          return parsed.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          }));
        }
      }
      return null;
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
      return null;
    }
  }, []);

  // Clear localStorage
  const clearLocalStorage = useCallback(() => {
    try {
      localStorage.removeItem(LEX_STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear localStorage:", error);
    }
  }, []);

  // Save conversation to database
  const saveConversation = useCallback(
    async (messages: Message[], title?: string, description?: string) => {
      if (messages.length <= 1) {
        alert("Have a conversation first before saving!");
        return null;
      }

      try {
        const response = await fetch("/api/lex/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title || `${sessionType} conversation`,
            description,
            messages: messages.map((msg) => ({
              sender: msg.sender,
              text: msg.text,
              timestamp: msg.timestamp.toISOString(),
              documentId: msg.documentId,
              jobContext: msg.jobContext,
              matchContext: msg.matchContext,
              tailoredResumeContext: msg.tailoredResumeContext,
            })),
            topic: sessionType,
          }),
        });

        const data = await response.json();

        if (data.success) {
          return data.conversationId;
        } else {
          throw new Error(data.error || "Failed to save");
        }
      } catch (error) {
        console.error("Save conversation error:", error);
        alert("Failed to save conversation");
        return null;
      }
    },
    [sessionType]
  );

  // Load conversation from database
  const loadConversation = useCallback(
    async (conversationId: string): Promise<Message[] | null> => {
      try {
        const response = await fetch(
          `/api/lex/conversations?conversationId=${conversationId}`
        );
        const data = await response.json();

        if (data.success && data.messages) {
          return data.messages.map((msg: any) => ({
            id: msg.id,
            text: msg.text,
            sender: msg.sender,
            timestamp: new Date(msg.timestamp),
            documentId: msg.attachments?.[0]?.documentId,
            jobContext: msg.jobContext,
            matchContext: msg.matchContext,
            tailoredResumeContext: msg.tailoredResumeContext,
          }));
        }

        return null;
      } catch (error) {
        console.error("Load conversation error:", error);
        alert("Failed to load conversation");
        return null;
      }
    },
    []
  );

  return {
    saveToLocalStorage,
    loadFromLocalStorage,
    clearLocalStorage,
    saveConversation,
    loadConversation,
  };
}
