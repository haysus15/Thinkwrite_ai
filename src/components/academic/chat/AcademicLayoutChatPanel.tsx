"use client";

import { RecoveryState } from "@/components/shared/RecoveryState";
import AcademicChatPanel from "./AcademicChatPanel";
import { useAcademicChatSessionContext } from "./AcademicChatSessionContext";

export default function AcademicLayoutChatPanel() {
  const session = useAcademicChatSessionContext();

  if (!session) {
    return (
      <aside className="academic-layout-chat-panel hidden shrink-0 xl:flex xl:items-start">
        <RecoveryState
          title="Unable to load chat"
          description="Refresh the page to continue. Your work is saved."
        />
      </aside>
    );
  }

  if (!session.hasUser) return null;

  return (
    <div className="academic-layout-chat-panel shrink-0">
      <AcademicChatPanel
        activeAssistant={session.activeAssistant}
        messages={session.panelMessages}
        travisChatInput={session.travisChatInput}
        travisChatLoading={session.travisChatLoading}
        bridgeTransferring={session.bridgeTransferring}
        crossLanguageNotice={session.crossLanguageNotice}
        crossLanguageProfileVersion={session.crossLanguageProfileVersion}
        pendingTravisAction={session.pendingTravisAction}
        setTravisChatInput={session.setTravisChatInput}
        sendTravisMessage={session.sendTravisMessage}
        confirmPendingTravisAction={session.confirmPendingTravisAction}
        rejectPendingTravisAction={session.rejectPendingTravisAction}
        handleFileUpload={session.handleFileUpload}
        handleChangeAssignmentType={session.handleChangeAssignmentType}
        showChangeAssignmentLink={session.workspace.type === "studio"}
      />
    </div>
  );
}
