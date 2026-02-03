// src/components/lex/hooks/useMatchContext.ts
"use client";

import { useState, useEffect } from "react";
import { MatchContext } from "../types/lex.types";

export function useMatchContext() {
  const [matchContext, setMatchContext] = useState<MatchContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMatchContext = () => {
      try {
        const stored = sessionStorage.getItem("lexMatchContext");
        if (stored) {
          const matchData = JSON.parse(stored) as MatchContext;
          setMatchContext(matchData);
          
          // Clear from sessionStorage after loading
          sessionStorage.removeItem("lexMatchContext");
        }
      } catch (error) {
        console.error("Failed to load match context:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMatchContext();
  }, []);

  return { matchContext, isLoading };
}