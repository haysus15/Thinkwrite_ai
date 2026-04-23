"use client";

import { useId, useState } from "react";
import { ChevronLeft, MessageSquare, X } from "lucide-react";
import TravisChatPanel from "../travis-sidebar/components/TravisChatPanel";

type AcademicChatPanelProps = {
  activeAssistant: "travis" | "victor";
  messages: Array<{
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
  handleFileUpload: (file: File, message: string) => Promise<void>;
  handleChangeAssignmentType: () => Promise<void>;
  showChangeAssignmentLink: boolean;
};

export default function AcademicChatPanel({
  activeAssistant,
  messages,
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
  handleFileUpload,
  handleChangeAssignmentType,
  showChangeAssignmentLink,
}: AcademicChatPanelProps) {
  const [uploading, setUploading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const fileInputId = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-4 right-4 z-[65] inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-slate-950/90 text-slate-100 shadow-lg backdrop-blur-md xl:hidden"
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      <aside
        className={`hidden h-[calc(100vh-120px)] flex-col rounded-3xl border border-white/10 bg-slate-950/60 p-4 backdrop-blur-md xl:flex ${
          collapsed ? "w-16" : "w-80"
        }`}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-200 transition hover:bg-white/[0.06]"
            aria-label={collapsed ? "Expand chat panel" : "Collapse chat panel"}
          >
            <ChevronLeft className={`h-4 w-4 transition ${collapsed ? "rotate-180" : ""}`} />
          </button>
          {!collapsed ? (
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Talk to Victor / Travis
            </div>
          ) : null}
        </div>

        {collapsed ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-[11px] text-slate-400">
            <MessageSquare className="h-5 w-5 text-slate-200" />
            <span className="[writing-mode:vertical-rl] rotate-180 tracking-[0.2em]">
              CHAT
            </span>
          </div>
        ) : (
          <PanelBody
            activeAssistant={activeAssistant}
            fileInputId={fileInputId}
            uploading={uploading}
            setUploading={setUploading}
            handleFileUpload={handleFileUpload}
            travisChatInput={travisChatInput}
            messages={messages}
            travisChatLoading={travisChatLoading}
            bridgeTransferring={bridgeTransferring}
            crossLanguageNotice={crossLanguageNotice}
            crossLanguageProfileVersion={crossLanguageProfileVersion}
            pendingTravisAction={pendingTravisAction}
            setTravisChatInput={setTravisChatInput}
            sendTravisMessage={sendTravisMessage}
            confirmPendingTravisAction={confirmPendingTravisAction}
            rejectPendingTravisAction={rejectPendingTravisAction}
            handleChangeAssignmentType={handleChangeAssignmentType}
            showChangeAssignmentLink={showChangeAssignmentLink}
          />
        )}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm xl:hidden">
          <div className="absolute inset-x-0 bottom-0 h-[80vh] rounded-t-3xl border border-white/10 bg-slate-950/95 p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-100">Academic Chat</p>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <PanelBody
              activeAssistant={activeAssistant}
              fileInputId={fileInputId}
              uploading={uploading}
              setUploading={setUploading}
              handleFileUpload={handleFileUpload}
              travisChatInput={travisChatInput}
              messages={messages}
              travisChatLoading={travisChatLoading}
              bridgeTransferring={bridgeTransferring}
              crossLanguageNotice={crossLanguageNotice}
              crossLanguageProfileVersion={crossLanguageProfileVersion}
              pendingTravisAction={pendingTravisAction}
              setTravisChatInput={setTravisChatInput}
              sendTravisMessage={sendTravisMessage}
              confirmPendingTravisAction={confirmPendingTravisAction}
              rejectPendingTravisAction={rejectPendingTravisAction}
              handleChangeAssignmentType={handleChangeAssignmentType}
              showChangeAssignmentLink={showChangeAssignmentLink}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function PanelBody({
  activeAssistant,
  fileInputId,
  uploading,
  setUploading,
  handleFileUpload,
  travisChatInput,
  messages,
  travisChatLoading,
  bridgeTransferring,
  crossLanguageNotice,
  crossLanguageProfileVersion,
  pendingTravisAction,
  setTravisChatInput,
  sendTravisMessage,
  confirmPendingTravisAction,
  rejectPendingTravisAction,
  handleChangeAssignmentType,
  showChangeAssignmentLink,
}: AcademicChatPanelProps & {
  fileInputId: string;
  uploading: boolean;
  setUploading: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Academic Chat
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-100">
              {activeAssistant === "victor" ? "Victor is active" : "Travis is active"}
            </p>
          </div>
          <div
            className={`rounded-full px-3 py-1 text-xs ${
              activeAssistant === "victor"
                ? "bg-sky-500/15 text-sky-200"
                : "bg-teal-500/15 text-teal-200"
            }`}
          >
            {activeAssistant === "victor" ? "Socratic mode" : "Planning mode"}
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-300">
          {activeAssistant === "victor"
            ? "Victor handles learning inside paper and math workflows. Travis stays available for planning."
            : "Tell Travis what you need and he will route the right workspace without leaving this session."}
        </p>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div>
          <p className="text-sm font-medium text-slate-100">Add a file from chat</p>
          <p className="text-xs text-slate-400">
            Notes, prompts, or worksheets can route directly into the right workspace.
          </p>
        </div>
        <label
          htmlFor={fileInputId}
          className="cursor-pointer rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 transition hover:bg-black/45"
        >
          {uploading ? "Uploading..." : "Choose file"}
        </label>
        <input
          id={fileInputId}
          type="file"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setUploading(true);
            try {
              await handleFileUpload(file, travisChatInput);
            } finally {
              setUploading(false);
              event.currentTarget.value = "";
            }
          }}
        />
      </div>

      <div className="min-h-0 flex-1">
        <TravisChatPanel
          travisChatMessages={messages}
          travisChatInput={travisChatInput}
          travisChatLoading={travisChatLoading}
          bridgeTransferring={bridgeTransferring}
          crossLanguageNotice={crossLanguageNotice}
          crossLanguageProfileVersion={crossLanguageProfileVersion}
          pendingTravisAction={pendingTravisAction}
          setTravisChatInput={setTravisChatInput}
          sendTravisMessage={sendTravisMessage}
          confirmPendingTravisAction={confirmPendingTravisAction}
          rejectPendingTravisAction={rejectPendingTravisAction}
          showChangeAssignmentLink={showChangeAssignmentLink}
          handleChangeAssignmentType={handleChangeAssignmentType}
        />
      </div>
    </div>
  );
}
