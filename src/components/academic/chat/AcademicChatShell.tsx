"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Paperclip, Send } from "lucide-react";
import { getAuthRequiredUrl } from "@/lib/auth/redirects";
import AcademicEmptyState from "@/components/academic/shared/AcademicEmptyState";
import AcademicLoadingState from "@/components/academic/shared/AcademicLoadingState";
import { RecoveryState } from "@/components/shared/RecoveryState";
import { useAcademicShellState } from "@/components/academic/shell/AcademicShellStateContext";
import AcademicStudioWorkspace from "./AcademicStudioWorkspace";
import { useAcademicChatSessionContext } from "./AcademicChatSessionContext";

const TRAVIS_ENTRY_GREETING =
  "I'm Travis — your academic assistant. Tell me what you're working on today, or upload your assignment and I'll take it from there.";

export default function AcademicChatShell() {
  const t = useTranslations();
  const session = useAcademicChatSessionContext();
  const { shellState } = useAcademicShellState();

  if (!session) {
    return (
      <div className="relative z-10 flex min-h-[calc(100vh-104px)] items-center justify-center px-6">
        <RecoveryState
          title="Unable to load this session"
          description="Refresh the page to continue. Your work is saved."
        />
      </div>
    );
  }

  if (session.authLoading || (session.hasUser && (session.firstTime.loading || session.settingsLoading))) {
    return (
      <div className="relative z-10 flex min-h-[calc(100vh-104px)] items-center justify-center px-6">
        <AcademicLoadingState message={t("loadingStates.academicDashboard")} />
      </div>
    );
  }

  if (!session.hasUser) {
    return (
      <div className="relative z-10 flex min-h-[calc(100vh-104px)] items-center justify-center p-6">
        <AcademicEmptyState
          title={t("academic.shared.authRequired")}
          description={t("academic.shared.authDashboard")}
          action={{
            label: t("auth.signIn.submit"),
            onClick: () => {
              window.location.href = getAuthRequiredUrl("/academic");
            },
          }}
          className="max-w-md rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md"
        />
      </div>
    );
  }

  if (shellState !== "workspace") {
    return (
      <div className="flex min-h-[calc(100vh-160px)] items-center justify-center">
        <EntryChatSurface
          shellState={shellState}
          messages={session.panelMessages}
          loading={session.travisChatLoading}
          input={session.travisChatInput}
          setInput={session.setTravisChatInput}
          sendMessage={session.sendTravisMessage}
          handleFileUpload={session.handleFileUpload}
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      <AcademicStudioWorkspace
        workspace={session.workspace}
        activeAssistant={session.activeAssistant}
        uploadContext={session.uploadContext}
      />
    </div>
  );
}

function EntryChatSurface({
  shellState,
  messages,
  loading,
  input,
  setInput,
  sendMessage,
  handleFileUpload,
}: {
  shellState: "entry" | "confirming";
  messages: Array<{
    id: string;
    role: "user" | "travis" | "system";
    text: string;
  }>;
  loading: boolean;
  input: string;
  setInput: (value: string) => void;
  sendMessage: (message: string) => Promise<void>;
  handleFileUpload: (file: File, message: string) => Promise<void>;
}) {
  const fileInputId = useId();
  const [uploading, setUploading] = useState(false);

  return (
    <section className="w-full max-w-[720px] rounded-[32px] border border-white/10 bg-slate-950/60 p-8 shadow-2xl backdrop-blur-md">
      <div className="text-center">
        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
          Academic Studio
        </p>
        {shellState === "entry" ? (
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-100">
            {TRAVIS_ENTRY_GREETING}
          </p>
        ) : null}
      </div>

      <div className={`${shellState === "entry" ? "mt-10" : "mt-4"} space-y-4`}>
        <div className="max-h-[320px] space-y-3 overflow-y-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-2xl px-4 py-3 text-sm ${
                message.role === "user"
                  ? "ml-auto max-w-[80%] border border-teal-400/20 bg-teal-500/10 text-teal-100"
                  : "max-w-[92%] border border-white/10 bg-white/[0.04] text-slate-200"
              }`}
            >
              {message.text}
            </div>
          ))}
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-end gap-3">
            <label
              htmlFor={fileInputId}
              className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-slate-300 transition hover:bg-black/35"
              aria-label="Upload assignment"
            >
              <Paperclip className="h-4 w-4" />
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
                  await handleFileUpload(file, input.trim());
                  setInput("");
                } finally {
                  setUploading(false);
                  event.currentTarget.value = "";
                }
              }}
            />

            <div className="flex-1">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={2}
                placeholder="Type your assignment or upload it here."
                className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                const prompt = input.trim();
                if (!prompt) return;
                setInput("");
                void sendMessage(prompt);
              }}
              disabled={loading || uploading || !input.trim()}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-400/40 bg-sky-500/15 text-sky-200 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            {uploading
              ? "Uploading your file..."
              : "Describe the assignment in your own words or upload the prompt directly."}
          </p>
        </div>
      </div>
    </section>
  );
}
