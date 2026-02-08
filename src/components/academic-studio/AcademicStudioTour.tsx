// src/components/academic-studio/AcademicStudioTour.tsx
// Academic Studio onboarding tour
"use client";

import { useEffect, useState, type ReactNode } from "react";
import styles from "./AcademicStudioTour.module.css";
import { useAuth } from "@/contexts/AuthContext";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  isFirstTime: boolean;
  onComplete: () => void;
  onStartPaperWorkflow: () => void;
};

type Step = {
  title: string;
  subtitle?: string;
  content: ReactNode;
};

export default function AcademicStudioTour({
  isFirstTime,
  onComplete,
  onStartPaperWorkflow,
}: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [remoteCompleted, setRemoteCompleted] = useState<boolean | null>(null);
  const { user } = useAuth();
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    const dismissed = localStorage.getItem("academic-tour-dismissed");
    if (isFirstTime && !dismissed && remoteCompleted !== true) {
      setIsVisible(true);
    }
  }, [isFirstTime, remoteCompleted]);

  useEffect(() => {
    if (!isFirstTime || !user) return;
    let isMounted = true;

    supabase
      .from("user_onboarding")
      .select("academic_tour_completed_at")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!isMounted) return;
        if (data?.academic_tour_completed_at) {
          localStorage.setItem("academic-tour-dismissed", "true");
          setRemoteCompleted(true);
          setIsVisible(false);
        } else {
          setRemoteCompleted(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isFirstTime, user?.id, supabase]);

  const handleDismiss = () => {
    localStorage.setItem("academic-tour-dismissed", "true");
    setIsVisible(false);
    setRemoteCompleted(true);
    if (user) {
      supabase
        .from("user_onboarding")
        .upsert({
          user_id: user.id,
          academic_tour_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .then(() => {});
    }
    onComplete();
  };

  const handleStart = () => {
    handleDismiss();
    onStartPaperWorkflow();
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isVisible]);

  const steps: Step[] = [
    {
      title: "Welcome to Academic Studio",
      subtitle: "Victor and Travis keep you honest",
      content: (
        <div className={styles.stepContent}>
          <p className={styles.mainText}>
            Academic Studio helps you outline, write, verify, and study with clear
            requirements. It pushes rigor, not shortcuts.
          </p>
          <div className={styles.featureHighlight}>
            <span>Structure first. Understanding always.</span>
          </div>
        </div>
      ),
    },
    {
      title: "Core Workspaces",
      content: (
        <div className={styles.stepContent}>
          <div className={styles.toolGrid}>
            <div className={styles.toolCard}>
              <div className={styles.toolTitle}>Paper Workflow</div>
              <div className={styles.toolDesc}>Outline → Generate → Checkpoint</div>
            </div>
            <div className={styles.toolCard}>
              <div className={styles.toolTitle}>Study Materials</div>
              <div className={styles.toolDesc}>Upload guides and build quizzes</div>
            </div>
            <div className={styles.toolCard}>
              <div className={styles.toolTitle}>Assignments</div>
              <div className={styles.toolDesc}>Deadlines and requirements</div>
            </div>
            <div className={styles.toolCard}>
              <div className={styles.toolTitle}>Math Mode</div>
              <div className={styles.toolDesc}>Step-by-step verification</div>
            </div>
          </div>
          <p className={styles.hintText}>
            Each workspace is designed for academic integrity.
          </p>
        </div>
      ),
    },
    {
      title: "Meet the Guides",
      content: (
        <div className={styles.stepContent}>
          <div className={styles.processSteps}>
            <div className={styles.processStep}>
              <div className={styles.processNumber}>V</div>
              <div className={styles.processLabel}>Victor</div>
              <div className={styles.processDesc}>Socratic rigor</div>
            </div>
            <div className={styles.processArrow}>→</div>
            <div className={styles.processStep}>
              <div className={styles.processNumber}>T</div>
              <div className={styles.processLabel}>Travis</div>
              <div className={styles.processDesc}>Requirements + deadlines</div>
            </div>
          </div>
          <p className={styles.hintText}>
            You must pass checkpoints to export. No shortcutting.
          </p>
        </div>
      ),
    },
    {
      title: "Start with the Paper Workflow",
      content: (
        <div className={`${styles.stepContent} ${styles.finalStep}`}>
          <p className={styles.mainText}>
            Open the paper workflow to outline your assignment, generate the draft
            in your voice, and pass the understanding checkpoint.
          </p>
          <div className={styles.ctaSection}>
            <button className={styles.btnPrimary} onClick={handleStart}>
              Open Paper Workflow
            </button>
            <button className={styles.btnSecondary} onClick={handleDismiss}>
              I will explore first
            </button>
          </div>
        </div>
      ),
    },
  ];

  if (!isVisible) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className={styles.tourOverlay}>
      <div className={styles.tourModal}>
        <button className={styles.skipBtn} onClick={handleDismiss}>
          Skip Tour
        </button>

        <div className={styles.progressDots}>
          {steps.map((_, index) => (
            <button
              key={index}
              className={`${styles.dot} ${index === currentStep ? styles.dotActive : ""} ${
                index < currentStep ? styles.dotCompleted : ""
              }`}
              onClick={() => setCurrentStep(index)}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>

        <div className={styles.stepContainer}>
          <h2 className={styles.stepTitle}>{step.title}</h2>
          {step.subtitle && <p className={styles.stepSubtitle}>{step.subtitle}</p>}
          {step.content}
        </div>

        {!isLastStep && (
          <div className={styles.navButtons}>
            <button
              className={`${styles.navBtn} ${styles.navBack}`}
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              Back
            </button>
            <button className={`${styles.navBtn} ${styles.navNext}`} onClick={handleNext}>
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
