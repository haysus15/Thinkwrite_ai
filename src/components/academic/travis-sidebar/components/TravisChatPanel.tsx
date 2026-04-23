"use client";

import { useTranslations } from "next-intl";
import BridgeModeIndicator from "@/components/shared/BridgeModeIndicator";
import SectionHeader from "../../shared/SectionHeader";
import CrossLanguageNotice from "@/components/shared/CrossLanguageNotice";
import AcademicEmptyState from "../../shared/AcademicEmptyState";
import { useBridgeMode } from "@/lib/bridge/useBridgeMode";
import shared from "../../shared/academic.module.css";

type TravisChatPanelProps = {
  travisChatMessages: Array<{
    id: string;
    role: "user" | "travis" | "system";
    text: string;
  }>;
  travisChatInput: string;
  travisChatLoading: boolean;
  bridgeTransferring: boolean;
  crossLanguageNotice: string | null;
  crossLanguageProfileVersion: 1 | 2 | null;
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
  showChangeAssignmentLink?: boolean;
  handleChangeAssignmentType?: () => Promise<void>;
};

export default function TravisChatPanel({
  travisChatMessages,
  travisChatInput,
  travisChatLoading,
  bridgeTransferring,
  crossLanguageNotice,
  crossLanguageProfileVersion,
  pendingTravisAction,
  setTravisChatInput,
  sendTravisMessage,
  confirmPendingTravisAction,
  rejectPendingTravisAction,
  showChangeAssignmentLink = false,
  handleChangeAssignmentType,
}: TravisChatPanelProps) {
  const t = useTranslations("academic.travisUi.chat");
  const bridgeMode = useBridgeMode();
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <SectionHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        className="mb-2"
      />
      <CrossLanguageNotice
        notice={crossLanguageNotice}
        profileVersion={crossLanguageProfileVersion}
        className="mb-2"
      />
      {pendingTravisAction && (
        <p className="mb-2 text-[11px] text-amber-200">● {t("waiting")}</p>
      )}
      <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-2 text-xs">
        {travisChatMessages.length === 0 && (
          <AcademicEmptyState
            title={t("empty")}
            description={t("description")}
            className="!min-h-0 border-0 bg-transparent py-3"
          />
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
      {bridgeMode.isActive && (
        <BridgeModeIndicator
          sourceLanguage={bridgeMode.sourceLanguage}
          isTransferring={bridgeTransferring}
          className="mt-2"
        />
      )}
      <div className="mt-2 flex items-center gap-2">
        <input
          value={travisChatInput}
          onChange={(event) => setTravisChatInput(event.target.value)}
          className="flex-1 rounded border border-white/20 bg-black/25 px-2 py-1.5 text-xs text-slate-100 focus:border-teal-300 focus:outline-none"
          placeholder={t("placeholder")}
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
          {travisChatLoading ? "..." : t("send")}
        </button>
      </div>
      {showChangeAssignmentLink && handleChangeAssignmentType ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => void handleChangeAssignmentType()}
            className="text-[11px] text-slate-300 underline-offset-4 transition hover:text-white hover:underline"
          >
            Change assignment type
          </button>
        </div>
      ) : null}
      {pendingTravisAction && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-2">
          <p className="flex-1 text-[11px] text-amber-100">
            {pendingTravisAction.summary || t("pendingSummary")}
          </p>
          <button
            type="button"
            onClick={() => void confirmPendingTravisAction()}
            className={`${shared.buttonBase} ${shared.buttonPrimary}`}
          >
            {t("confirm")}
          </button>
          <button
            type="button"
            onClick={rejectPendingTravisAction}
            className={`${shared.buttonBase} ${shared.buttonSecondary}`}
          >
            {t("reject")}
          </button>
        </div>
      )}
    </div>
  );
}
