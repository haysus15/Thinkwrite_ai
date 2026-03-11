// src/components/academic-studio/travis-sidebar/TravisSidebar.tsx
"use client";

import { useRouter } from "next/navigation";
import shared from "../shared/academic-studio.module.css";
import ClassFilter from "./components/ClassFilter";
import OverdueAssignmentsPanel from "./components/OverdueAssignmentsPanel";
import TravisChatPanel from "./components/TravisChatPanel";
import TravisControlsPanel from "./components/TravisControlsPanel";
import WeeklyView from "./components/WeeklyView";
import { isCodingAssignment, toGuidancePreview } from "./hooks/travisShared";
import { useAssignments } from "./hooks/useAssignments";
import { useSyllabusReview } from "./hooks/useSyllabusReview";
import { useTravisChat } from "./hooks/useTravisChat";
import { useReminderTriggers } from "./hooks/useReminderTriggers";

export default function TravisSidebar() {
  const router = useRouter();
  const { runReminderEvaluation } = useReminderTriggers();
  const assignments = useAssignments({ runReminderEvaluation });
  const syllabusReview = useSyllabusReview({
    onPublished: assignments.loadAssignments,
  });
  const chat = useTravisChat({
    agendaItems: [
      ...assignments.upcomingAssignments,
      ...assignments.overdueAssignments,
    ],
  });

  const {
    upcomingAssignments,
    overdueAssignments,
    loading,
    error,
    expandedClasses,
    editingAssignmentId,
    editingDraft,
    showAddAssignmentForm,
    creatingAssignment,
    newAssignmentDraft,
    showAccountabilityForm,
    classPlans,
    planDraft,
    selectedWeekStart,
    selectedWeekDayKey,
    weekCalendarDays,
    visibleMonthStart,
    monthGridDays,
    canGoPrevWeek,
    canGoNextWeek,
    canGoPrevMonth,
    canGoNextMonth,
    weeklyUpcomingAssignments,
    calendarSignalByDate,
    filteredWeeklyAssignments,
    unscheduledAssignments,
    upcomingByClass,
    weeklyClassCount,
    todayDateKey,
    classPlanByName,
    setError,
    setExpandedClasses,
    setEditingDraft,
    setShowAddAssignmentForm,
    setShowAccountabilityForm,
    setNewAssignmentDraft,
    setPlanDraft,
    setSelectedWeekStart,
    setSelectedWeekDayKey,
    startEditingAssignment,
    cancelEditingAssignment,
    saveAssignmentEdit,
    removeAssignment,
    markAssignmentComplete,
    planAssignmentToday,
    planAssignmentTomorrow,
    planAssignmentOnSelectedDay,
    clearAssignmentPlanDate,
    planAssignmentsForToday,
    planAssignmentsForTomorrow,
    planAssignmentsForThisWeekend,
    resetNewAssignmentDraft,
    createAssignment,
    saveClassPlan,
    removeClassPlan,
    goToWeek,
    goToMonth,
    jumpToToday,
  } = assignments;

  const {
    uploading,
    parsedSyllabusId,
    reviewClassName,
    reviewDrafts,
    publishing,
    approvedCount,
    setReviewDrafts,
    handleUpload,
    publishReviewedSyllabus,
  } = syllabusReview;

  const {
    travisChatMessages,
    travisChatInput,
    travisChatLoading,
    pendingTravisAction,
    setTravisChatInput,
    sendTravisMessage,
    confirmPendingTravisAction,
    rejectPendingTravisAction,
  } = chat;

  const handleUploadWithErrors = async (file: File) => {
    setError(null);
    try {
      await handleUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  };

  const publishReviewedSyllabusWithErrors = async () => {
    setError(null);
    try {
      await publishReviewedSyllabus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve and publish failed.");
    }
  };

  return (
    <div className={`${shared.root} ${shared.page} space-y-5`}>
      <WeeklyView
        weeklyUpcomingAssignmentsLength={weeklyUpcomingAssignments.length}
        weeklyClassCount={weeklyClassCount}
        overdueAssignmentsLength={overdueAssignments.length}
        visibleMonthStart={visibleMonthStart}
        canGoPrevMonth={canGoPrevMonth}
        canGoNextMonth={canGoNextMonth}
        goToMonth={goToMonth}
        selectedWeekStart={selectedWeekStart}
        jumpToToday={jumpToToday}
        monthGridDays={monthGridDays}
        calendarSignalByDate={calendarSignalByDate}
        selectedWeekDayKey={selectedWeekDayKey}
        todayDateKey={todayDateKey}
        weekCalendarDays={weekCalendarDays}
        setSelectedWeekStart={(day) => setSelectedWeekStart(day)}
        setSelectedWeekDayKey={setSelectedWeekDayKey}
        canGoPrevWeek={canGoPrevWeek}
        canGoNextWeek={canGoNextWeek}
        goToWeek={goToWeek}
      />

      <OverdueAssignmentsPanel
        overdueAssignments={overdueAssignments}
        editingAssignmentId={editingAssignmentId}
        editingDraft={editingDraft}
        selectedWeekDayKey={selectedWeekDayKey}
        setEditingDraft={setEditingDraft}
        saveAssignmentEdit={saveAssignmentEdit}
        cancelEditingAssignment={cancelEditingAssignment}
        startEditingAssignment={startEditingAssignment}
        removeAssignment={removeAssignment}
        markAssignmentComplete={markAssignmentComplete}
        planAssignmentToday={planAssignmentToday}
        planAssignmentTomorrow={planAssignmentTomorrow}
        planAssignmentOnSelectedDay={planAssignmentOnSelectedDay}
        clearAssignmentPlanDate={clearAssignmentPlanDate}
        onOpenPaper={(assignmentId) =>
          router.push(`/academic/paper-workflow?assignmentId=${assignmentId}`)
        }
        onOpenCoding={(assignmentId) =>
          router.push(`/academic/coding-review?assignmentId=${assignmentId}`)
        }
      />

      <ClassFilter
        loading={loading}
        selectedWeekStart={selectedWeekStart}
        selectedWeekDayKey={selectedWeekDayKey}
        upcomingAssignments={upcomingAssignments}
        filteredWeeklyAssignments={filteredWeeklyAssignments}
        unscheduledAssignments={unscheduledAssignments}
        upcomingByClass={upcomingByClass}
        expandedClasses={expandedClasses}
        classPlanByName={classPlanByName}
        editingAssignmentId={editingAssignmentId}
        editingDraft={editingDraft}
        setExpandedClasses={setExpandedClasses}
        setEditingDraft={setEditingDraft}
        onSaveAssignmentEdit={saveAssignmentEdit}
        onCancelEdit={cancelEditingAssignment}
        onStartEdit={startEditingAssignment}
        onComplete={markAssignmentComplete}
        onPlanToday={planAssignmentToday}
        onPlanTomorrow={planAssignmentTomorrow}
        onPlanSelectedDay={
          selectedWeekDayKey === "all" ? undefined : planAssignmentOnSelectedDay
        }
        onClearPlan={clearAssignmentPlanDate}
        onBulkPlanToday={planAssignmentsForToday}
        onBulkPlanTomorrow={planAssignmentsForTomorrow}
        onBulkPlanWeekend={planAssignmentsForThisWeekend}
        onRemove={removeAssignment}
        onOpenPaper={(assignmentId) =>
          router.push(
            `/academic/paper-workflow?assignmentId=${assignmentId}`
          )
        }
        onOpenCoding={(assignmentId) =>
          router.push(
            `/academic/coding-review?assignmentId=${assignmentId}`
          )
        }
        isCodingAssignment={isCodingAssignment}
        toGuidancePreview={toGuidancePreview}
      />

      <TravisChatPanel
        travisChatMessages={travisChatMessages}
        travisChatInput={travisChatInput}
        travisChatLoading={travisChatLoading}
        pendingTravisAction={pendingTravisAction}
        setTravisChatInput={setTravisChatInput}
        sendTravisMessage={sendTravisMessage}
        confirmPendingTravisAction={confirmPendingTravisAction}
        rejectPendingTravisAction={rejectPendingTravisAction}
      />

      <TravisControlsPanel
        error={error}
        setError={setError}
        showAddAssignmentForm={showAddAssignmentForm}
        setShowAddAssignmentForm={setShowAddAssignmentForm}
        creatingAssignment={creatingAssignment}
        newAssignmentDraft={newAssignmentDraft}
        setNewAssignmentDraft={setNewAssignmentDraft}
        resetNewAssignmentDraft={resetNewAssignmentDraft}
        createAssignment={createAssignment}
        showAccountabilityForm={showAccountabilityForm}
        setShowAccountabilityForm={setShowAccountabilityForm}
        planDraft={planDraft}
        setPlanDraft={setPlanDraft}
        saveClassPlan={saveClassPlan}
        classPlans={classPlans}
        removeClassPlan={removeClassPlan}
        uploading={uploading}
        handleUploadWithErrors={handleUploadWithErrors}
        parsedSyllabusId={parsedSyllabusId}
        reviewClassName={reviewClassName}
        reviewDrafts={reviewDrafts}
        setReviewDrafts={setReviewDrafts}
        publishing={publishing}
        approvedCount={approvedCount}
        publishReviewedSyllabusWithErrors={publishReviewedSyllabusWithErrors}
        onOpenReviewPage={(syllabusId) => router.push(`/academic/syllabi?syllabus=${syllabusId}`)}
      />
    </div>
  );
}
