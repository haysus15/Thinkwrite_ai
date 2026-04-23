"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type ShellState = "entry" | "confirming" | "workspace";

interface AcademicShellStateContextValue {
  shellState: ShellState;
  setShellState: (state: ShellState) => void;
}

const AcademicShellStateContext = createContext<AcademicShellStateContextValue | null>(null);

export function AcademicShellStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [shellState, setShellState] = useState<ShellState>("entry");
  const value = useMemo(
    () => ({
      shellState,
      setShellState,
    }),
    [shellState]
  );

  return (
    <AcademicShellStateContext.Provider value={value}>
      {children}
    </AcademicShellStateContext.Provider>
  );
}

export function useAcademicShellState() {
  const context = useContext(AcademicShellStateContext);
  if (!context) {
    throw new Error("useAcademicShellState must be used within AcademicShellStateProvider");
  }
  return context;
}

export function AcademicShellLayoutController({
  children,
}: {
  children: React.ReactNode;
}) {
  const { shellState } = useAcademicShellState();

  return (
    <div
      className={`academic-studio-shell academic-studio-shell--${shellState}`}
      data-shell-state={shellState}
    >
      {children}
      <style jsx global>{`
        .academic-studio-content-row {
          transition: all 300ms ease-in-out;
        }

        .academic-studio-main,
        .academic-layout-chat-panel {
          transition: width 300ms ease-in-out, opacity 300ms ease-in-out;
        }

        .academic-studio-shell--entry .academic-layout-chat-panel,
        .academic-studio-shell--confirming .academic-layout-chat-panel {
          display: none;
        }

        .academic-studio-shell--entry .academic-studio-main,
        .academic-studio-shell--confirming .academic-studio-main {
          width: 100%;
          max-width: 100%;
        }

        .academic-studio-shell--workspace .academic-studio-main {
          width: 70%;
          flex: 0 1 70%;
        }

        .academic-studio-shell--workspace .academic-layout-chat-panel {
          width: 30%;
          min-width: 280px;
          display: flex;
        }
      `}</style>
    </div>
  );
}
