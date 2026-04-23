"use client";

import { createContext, useContext } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAcademicSettings } from "@/hooks/academic/useAcademicSettings";
import { useAcademicChatSession } from "./useAcademicChatSession";

type AcademicChatSessionContextValue = ReturnType<typeof useAcademicChatSession> & {
  authLoading: boolean;
  hasUser: boolean;
  settingsLoading: boolean;
};

const AcademicChatSessionContext =
  createContext<AcademicChatSessionContextValue | null>(null);

export function AcademicChatSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const academicSettings = useAcademicSettings(user?.id);
  const session = useAcademicChatSession(user?.id, academicSettings.settings);

  return (
    <AcademicChatSessionContext.Provider
      value={{
        ...session,
        authLoading: loading,
        hasUser: Boolean(user),
        settingsLoading: academicSettings.loading,
      }}
    >
      {children}
    </AcademicChatSessionContext.Provider>
  );
}

export function useAcademicChatSessionContext() {
  return useContext(AcademicChatSessionContext);
}
