// src/components/academic-studio/study-materials/StudyLibrary.tsx
"use client";

import { useRouter } from "next/navigation";
import AcademicEmptyState from "../shared/AcademicEmptyState";
import AcademicErrorState from "../shared/AcademicErrorState";
import AcademicLoadingState from "../shared/AcademicLoadingState";
import SectionHeader from "../shared/SectionHeader";
import shared from "../shared/academic-studio.module.css";
import LibraryGrid from "./components/LibraryGrid";
import MaterialViewer from "./components/MaterialViewer";
import QuizGenerator from "./components/QuizGenerator";
import { useStudyLibrary } from "./hooks/useStudyLibrary";

export default function StudyLibrary({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const {
    materials,
    quizzes,
    loading,
    error,
    viewerLoading,
    selectedMaterial,
    printingGuide,
    exportingGuidePdf,
    questionCount,
    difficulty,
    questionTypes,
    latestAttemptByQuiz,
    selectedSections,
    setQuestionCount,
    setDifficulty,
    setSelectedMaterial,
    toggleType,
    openMaterialViewer,
    generateQuiz,
    deleteMaterial,
    handlePrintGuide,
    handleExportGuidePdf,
  } = useStudyLibrary(router);

  return (
    <div
      className={
        embedded
          ? `${shared.root} ${shared.page} w-full space-y-8`
          : `${shared.root} ${shared.page} min-h-screen bg-[#0B1220] px-6 py-10`
      }
    >
      <div className={embedded ? "w-full space-y-8" : "mx-auto w-full max-w-5xl space-y-8"}>
        {!embedded && (
          <SectionHeader
            eyebrow="Academic Studio"
            title="Study Hub library"
            actions={
              <button
                type="button"
                onClick={() => router.push("/academic/agenda")}
                className={`${shared.buttonBase} ${shared.buttonSecondary}`}
              >
                Back to studio
              </button>
            }
          />
        )}

        <QuizGenerator
          questionCount={questionCount}
          difficulty={difficulty}
          questionTypes={questionTypes}
          setQuestionCount={setQuestionCount}
          setDifficulty={setDifficulty}
          toggleType={toggleType}
        />

        {loading && <AcademicLoadingState message="Loading your Study Hub library..." />}
        {error && (
          <AcademicErrorState
            message={error}
            className="!min-h-0 border-red-500/40 bg-red-500/10 py-4"
          />
        )}

        {!loading && !error && (
          materials.length === 0 && quizzes.length === 0 ? (
            <AcademicEmptyState
              title="No materials in your library"
              description="Upload a document to begin."
            />
          ) : (
            <LibraryGrid
              materials={materials}
              quizzes={quizzes}
              latestAttemptByQuiz={latestAttemptByQuiz}
              onViewMaterial={openMaterialViewer}
              onGenerateQuiz={generateQuiz}
              onDeleteMaterial={deleteMaterial}
              onRetakeQuiz={(quizId) => router.push(`/academic/quiz/${quizId}`)}
            />
          )
        )}
      </div>

      <MaterialViewer
        viewerLoading={viewerLoading}
        selectedMaterial={selectedMaterial}
        selectedSections={selectedSections}
        printingGuide={printingGuide}
        exportingGuidePdf={exportingGuidePdf}
        onClose={() => setSelectedMaterial(null)}
        onPrintGuide={handlePrintGuide}
        onExportGuidePdf={handleExportGuidePdf}
      />
    </div>
  );
}
