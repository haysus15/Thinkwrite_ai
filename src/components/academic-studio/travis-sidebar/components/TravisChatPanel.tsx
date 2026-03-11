"use client";

import SectionHeader from "../../shared/SectionHeader";
import shared from "../../shared/academic-studio.module.css";

type TravisChatPanelProps = {
  travisChatMessages: Array<{
    id: string;
    role: "user" | "travis" | "system";
    text: string;
  }>;
  travisChatInput: string;
  travisChatLoading: boolean;
  pendingTravisAction: {
    type: string;
    summary: string;
    assignmentIds: string[];
  } | null;
  setTravisChatInput: (value: string) => void;
  sendTravisMessage: (
    message: string,
    options?: {
      assignmentId?: string;
      confirm?: boolean;
      reject?: boolean;
      systemMessage?: boolean;
    }
  ) => Promise<void>;
  confirmPendingTravisAction: () => Promise<void>;
  rejectPendingTravisAction: () => void;
};

export default function TravisChatPanel({
  travisChatMessages,
  travisChatInput,
  travisChatLoading,
  pendingTravisAction,
  setTravisChatInput,
  sendTravisMessage,
  confirmPendingTravisAction,
  rejectPendingTravisAction,
}: TravisChatPanelProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <SectionHeader
        eyebrow="Travis"
        title="Agenda planning with Travis"
        description="Ask Travis to plan your week, rebalance workload, or report progress."
        className="mb-2"
      />
      {pendingTravisAction && (
        <p className="mb-2 text-[11px] text-amber-200">● Waiting for your confirmation</p>
      )}
      <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-2 text-xs">
        {travisChatMessages.length === 0 && (
          <p className="text-slate-400">Try: “Plan my week”, “I’m behind”, or “Show my progress”.</p>
        )}
        {travisChatMessages.map((message) => (
          <div
            key={message.id}
            className={`rounded px-2 py-1 ${
              message.role === "user" ? "bg-teal-500/15 text-teal-100" : "bg-white/5 text-slate-200"
            }`}
          >
            {message.text}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={travisChatInput}
          onChange={(event) => setTravisChatInput(event.target.value)}
          className="flex-1 rounded border border-white/20 bg-black/25 px-2 py-1.5 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
          placeholder="Ask Travis..."
          disabled={Boolean(pendingTravisAction)}
        />
        <button
          type="button"
          disabled={travisChatLoading || !travisChatInput.trim() || Boolean(pendingTravisAction)}
          onClick={() => {
            const prompt = travisChatInput.trim();
            setTravisChatInput("");
            void sendTravisMessage(prompt);
          }}
          className={`${shared.buttonBase} ${shared.buttonPrimary}`}
        >
          {travisChatLoading ? "..." : "Send"}
        </button>
      </div>
      {pendingTravisAction && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-2">
          <p className="flex-1 text-[11px] text-amber-100">
            {pendingTravisAction.summary || "Proposed changes are ready. Apply them?"}
          </p>
          <button
            type="button"
            onClick={() => void confirmPendingTravisAction()}
            className={`${shared.buttonBase} ${shared.buttonPrimary}`}
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={rejectPendingTravisAction}
            className={`${shared.buttonBase} ${shared.buttonSecondary}`}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
