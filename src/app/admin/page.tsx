import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { TelemetryEventType } from "@/lib/telemetry/logEvent";

type TelemetryRow = {
  id: string;
  event_type: TelemetryEventType;
  workspace: string | null;
  severity: "info" | "warn" | "error";
  payload: Record<string, unknown> | null;
  created_at: string;
};

function dayKey(date: string) {
  return new Date(date).toISOString().slice(0, 10);
}

function formatDay(date: string) {
  const value = new Date(date);
  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default async function AdminPage() {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret) {
    return (
      <main className="min-h-screen bg-[#0B1220] px-6 py-10 text-slate-100">
        <div className="mx-auto w-full max-w-6xl rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
          Missing `ADMIN_SECRET` configuration.
        </div>
      </main>
    );
  }

  const headerKey = headerStore.get("x-admin-key");
  const cookieKey = cookieStore.get("ADMIN_SECRET")?.value;
  if (headerKey !== adminSecret && cookieKey !== adminSecret) {
    redirect("/");
  }

  const supabase = getSupabaseAdmin();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from("telemetry_events")
    .select("id, event_type, workspace, severity, payload, created_at")
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(5000);

  const events: TelemetryRow[] = error || !Array.isArray(data) ? [] : (data as TelemetryRow[]);

  const quizFailureEvents = events.filter(
    (event) => event.event_type === "quiz_generation_failed"
  );
  const quizFailuresByDay = quizFailureEvents.reduce<Record<string, number>>(
    (acc, event) => {
      const key = dayKey(event.created_at);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {}
  );

  const studyGuideThresholdEvents = events.filter(
    (event) => event.event_type === "study_guide_below_threshold"
  );
  const studyGuideScores = studyGuideThresholdEvents
    .map((event) => {
      const value = event.payload?.score;
      return typeof value === "number" ? value : null;
    })
    .filter((value): value is number => value !== null);
  const averageStudyGuideScore =
    studyGuideScores.length > 0
      ? Math.round(
          (studyGuideScores.reduce((sum, score) => sum + score, 0) /
            studyGuideScores.length) *
            10
        ) / 10
      : null;

  const assignmentErrorEvents = events.filter(
    (event) =>
      event.event_type === "assignment_parse_error" ||
      event.event_type === "assignment_parse_low_confidence"
  );
  const assignmentErrorsByDay = assignmentErrorEvents.reduce<Record<string, number>>(
    (acc, event) => {
      const key = dayKey(event.created_at);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {}
  );

  const userDropOffByWorkspace = events
    .filter((event) => event.event_type === "user_drop_off")
    .reduce<Record<string, number>>((acc, event) => {
      const key = event.workspace || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

  const sortedDayEntries = (source: Record<string, number>) =>
    Object.entries(source).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <main className="min-h-screen bg-[#0B1220] px-6 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Internal QA dashboard — not user-facing</p>
          <h1 className="mt-2 text-2xl font-semibold">Academic Studio Telemetry</h1>
          <p className="mt-1 text-sm text-slate-400">Last 30 days of generation telemetry events.</p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold">Quiz failures</h2>
            <p className="mt-1 text-sm text-slate-400">Count by day (last 30 days)</p>
            <div className="mt-3 space-y-1 text-sm">
              {sortedDayEntries(quizFailuresByDay).length === 0 && <p className="text-slate-500">No quiz failure events.</p>}
              {sortedDayEntries(quizFailuresByDay).map(([day, count]) => (
                <div key={day} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-1.5">
                  <span>{formatDay(day)}</span>
                  <span className="text-rose-300">{count}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-400">Latest 10 events</p>
            <div className="mt-2 space-y-2 text-xs">
              {quizFailureEvents.slice(0, 10).map((event) => (
                <div key={event.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <p className="text-slate-400">{new Date(event.created_at).toLocaleString()}</p>
                  <pre className="mt-1 whitespace-pre-wrap text-slate-200">{JSON.stringify(event.payload || {}, null, 2)}</pre>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold">Study guide quality</h2>
            <p className="mt-1 text-sm text-slate-400">Below-threshold events and average score from payload</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Below threshold</p>
                <p className="mt-1 text-2xl font-semibold text-amber-300">{studyGuideThresholdEvents.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Average score</p>
                <p className="mt-1 text-2xl font-semibold text-sky-300">
                  {averageStudyGuideScore === null ? "N/A" : averageStudyGuideScore}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold">Assignment parse errors</h2>
            <p className="mt-1 text-sm text-slate-400">Count by day and latest 10 events</p>
            <div className="mt-3 space-y-1 text-sm">
              {sortedDayEntries(assignmentErrorsByDay).length === 0 && <p className="text-slate-500">No assignment parse events.</p>}
              {sortedDayEntries(assignmentErrorsByDay).map(([day, count]) => (
                <div key={day} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-1.5">
                  <span>{formatDay(day)}</span>
                  <span className="text-rose-300">{count}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-400">Latest 10 events</p>
            <div className="mt-2 space-y-2 text-xs">
              {assignmentErrorEvents.slice(0, 10).map((event) => (
                <div key={event.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <p className="text-slate-400">{new Date(event.created_at).toLocaleString()}</p>
                  <p className="mt-1 text-slate-200">Class: {String(event.payload?.class_name || "n/a")}</p>
                  <pre className="mt-1 whitespace-pre-wrap text-slate-300">{JSON.stringify(event.payload || {}, null, 2)}</pre>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold">User drop-off</h2>
            <p className="mt-1 text-sm text-slate-400">Count by workspace (last 30 days)</p>
            <div className="mt-3 space-y-1 text-sm">
              {Object.entries(userDropOffByWorkspace).length === 0 && (
                <p className="text-slate-500">No drop-off events.</p>
              )}
              {Object.entries(userDropOffByWorkspace)
                .sort((a, b) => b[1] - a[1])
                .map(([workspace, count]) => (
                  <div key={workspace} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-1.5">
                    <span>{workspace}</span>
                    <span className="text-amber-300">{count}</span>
                  </div>
                ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
