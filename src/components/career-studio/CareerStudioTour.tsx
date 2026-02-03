// src/components/career-studio/CareerStudioTour.tsx
// Career Studio onboarding tour
"use client";

import { useEffect, useState, type ReactNode } from "react";
import styles from "./CareerStudioTour.module.css";

type Props = {
  isFirstTime: boolean;
  onComplete: () => void;
  onStartResumeManager: () => void;
};

type Step = {
  title: string;
  subtitle?: string;
  content: ReactNode;
};

export default function CareerStudioTour({
  isFirstTime,
  onComplete,
  onStartResumeManager,
}: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("career-tour-dismissed");
    if (isFirstTime && !dismissed) {
      setIsVisible(true);
    }
  }, [isFirstTime]);

  const handleDismiss = () => {
    localStorage.setItem("career-tour-dismissed", "true");
    setIsVisible(false);
    onComplete();
  };

  const handleStart = () => {
    handleDismiss();
    onStartResumeManager();
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
      title: "Welcome to Career Studio",
      subtitle: "Your career OS powered by Lex",
      content: (
        <div className={styles.stepContent}>
          <p className={styles.mainText}>
            Career Studio organizes everything you do for job search: resumes, job
            analysis, cover letters, applications, and your long-term plan.
          </p>
          <div className={styles.featureHighlight}>
            <span>Precision tools. One clean workflow.</span>
          </div>
        </div>
      ),
    },
    {
      title: "Core Tools",
      content: (
        <div className={styles.stepContent}>
          <div className={styles.toolGrid}>
            <div className={styles.toolCard}>
              <div className={styles.toolTitle}>Resume Manager</div>
              <div className={styles.toolDesc}>Upload, analyze, improve</div>
            </div>
            <div className={styles.toolCard}>
              <div className={styles.toolTitle}>Job Analysis</div>
              <div className={styles.toolDesc}>Decode roles fast</div>
            </div>
            <div className={styles.toolCard}>
              <div className={styles.toolTitle}>Tailor + Cover Letter</div>
              <div className={styles.toolDesc}>Targeted outputs</div>
            </div>
            <div className={styles.toolCard}>
              <div className={styles.toolTitle}>Applications</div>
              <div className={styles.toolDesc}>Track your pipeline</div>
            </div>
            <div className={styles.toolCard}>
              <div className={styles.toolTitle}>Assessment</div>
              <div className={styles.toolDesc}>Build your roadmap</div>
            </div>
          </div>
          <p className={styles.hintText}>
            Everything is connected so you never redo work.
          </p>
        </div>
      ),
    },
    {
      title: "Recommended Flow",
      content: (
        <div className={styles.stepContent}>
          <div className={styles.processSteps}>
            <div className={styles.processStep}>
              <div className={styles.processNumber}>1</div>
              <div className={styles.processLabel}>Resume</div>
              <div className={styles.processDesc}>Upload or build</div>
            </div>
            <div className={styles.processArrow}>→</div>
            <div className={styles.processStep}>
              <div className={styles.processNumber}>2</div>
              <div className={styles.processLabel}>Analyze</div>
              <div className={styles.processDesc}>Decode roles</div>
            </div>
            <div className={styles.processArrow}>→</div>
            <div className={styles.processStep}>
              <div className={styles.processNumber}>3</div>
              <div className={styles.processLabel}>Tailor</div>
              <div className={styles.processDesc}>Ship polished</div>
            </div>
          </div>
          <p className={styles.hintText}>
            Lex keeps strategy and language consistent across everything.
          </p>
        </div>
      ),
    },
    {
      title: "Start with a Resume",
      content: (
        <div className={`${styles.stepContent} ${styles.finalStep}`}>
          <p className={styles.mainText}>
            Begin by uploading a resume or creating one from scratch. We will use it
            to drive every analysis and application downstream.
          </p>
          <div className={styles.ctaSection}>
            <button className={styles.btnPrimary} onClick={handleStart}>
              Open Resume Manager
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
