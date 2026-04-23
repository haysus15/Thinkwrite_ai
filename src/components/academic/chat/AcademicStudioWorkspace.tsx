"use client";

import { Suspense } from "react";
import AcademicDashboard from "@/components/academic/workspace/AcademicDashboard";
import { RecoveryState } from "@/components/shared/RecoveryState";
import AcademicLoadingState from "@/components/academic/shared/AcademicLoadingState";
import { STUDIO_COMPONENTS, type StudioKey } from "@/components/academic/workspace/studioRegistry";
import type { AcademicWorkspaceContext } from "./chatTypes";

type AcademicStudioWorkspaceProps = {
  workspace: AcademicWorkspaceContext;
  activeAssistant: "travis" | "victor";
  uploadContext: {
    fileName: string;
    message: string;
  } | null;
};

export default function AcademicStudioWorkspace({
  workspace,
  activeAssistant,
  uploadContext,
}: AcademicStudioWorkspaceProps) {
  if (workspace.type === "dashboard") {
    return (
      <section className="min-h-[640px] rounded-3xl border border-white/10 bg-slate-950/50 p-6 backdrop-blur-md">
        <AcademicDashboard onNavigate={() => undefined} />
      </section>
    );
  }

  if (workspace.type === "idle") {
    return (
      <section className="flex min-h-[640px] items-center justify-center rounded-3xl border border-white/10 bg-slate-950/50 p-8 text-slate-100 backdrop-blur-md">
        <div className="max-w-xl text-center">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
            Academic Studio
          </p>
          <h2 className="mt-4 text-3xl font-semibold">
            Tell Travis what you need to work on today.
          </h2>
          <p className="mt-4 text-sm text-slate-300">
            The right workspace will open here and the chat will stay available
            beside it for the rest of the session.
          </p>
        </div>
      </section>
    );
  }

  const StudioComponent = STUDIO_COMPONENTS[workspace.studio as StudioKey];

  if (!StudioComponent) {
    return (
      <section className="min-h-[640px] rounded-3xl border border-white/10 bg-slate-950/50 p-6 backdrop-blur-md">
        <RecoveryState
          title="Studio not found"
          description="This workspace could not be loaded. Return to the dashboard and try again."
        />
      </section>
    );
  }

  return (
    <section className="min-h-[640px] rounded-3xl border border-white/10 bg-slate-950/50 p-3 backdrop-blur-md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-100">
            Current workspace: {workspace.studio.replace("_", " ")}
          </p>
          <p className="text-xs text-slate-400">
            {activeAssistant === "victor"
              ? "Victor is active for this workspace."
              : "Travis remains active for planning and routing."}
          </p>
        </div>
        {uploadContext ? (
          <div className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
            File queued: {uploadContext.fileName}
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
        <Suspense fallback={<AcademicLoadingState message="Opening your workspace..." />}>
          <StudioComponent
            assignmentId={workspace.assignmentId ?? null}
            paperId={workspace.paperId ?? null}
            reviewId={workspace.reviewId ?? null}
            setId={workspace.setId ?? null}
          />
        </Suspense>
      </div>
    </section>
  );
}
