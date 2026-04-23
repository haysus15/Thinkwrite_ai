"use client";

import MathModeHome from "@/components/academic/math-mode/MathModeHome";
import { VictorChatProvider } from "@/components/academic/victor-chat/VictorChatContext";

export function MathModeWrapper() {
  return (
    <div className="studio-workspace-content">
      <VictorChatProvider>
        <MathModeHome />
      </VictorChatProvider>
    </div>
  );
}
