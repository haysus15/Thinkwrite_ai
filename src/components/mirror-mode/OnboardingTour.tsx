// src/components/mirror-mode/OnboardingTour.tsx
// Onboarding Tour Modal - Multi-step welcome tour for new users
'use client';

import { useState, useEffect, type ReactNode } from 'react';
import styles from './OnboardingTour.module.css';

type Props = {
  isFirstTime: boolean;
  onComplete: () => void;
  onUploadClick: () => void;
};

type Step = {
  title: string;
  subtitle?: string;
  content: ReactNode;
};

export default function OnboardingTour({ isFirstTime, onComplete, onUploadClick }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('mm-tour-dismissed');
    if (isFirstTime && !dismissed) {
      setIsVisible(true);
    }
  }, [isFirstTime]);

  const handleDismiss = () => {
    localStorage.setItem('mm-tour-dismissed', 'true');
    setIsVisible(false);
    onComplete();
  };

  const handleUpload = () => {
    handleDismiss();
    onUploadClick();
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
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVisible]);

  const steps: Step[] = [
    {
      title: 'Welcome to Mirror Mode',
      subtitle: 'Meet Ursie, your voice learning companion',
      content: (
        <div className={styles.stepContent}>
          <p className={styles.mainText}>
            Mirror Mode learns <strong>YOUR</strong> unique writing style from documents you upload.
            No more generic AI — ThinkWrite will sound like you.
          </p>
          <div className={styles.featureHighlight}>
            <span>Your voice. Your style. Authentically you.</span>
          </div>
        </div>
      ),
    },
    {
      title: 'How Voice Learning Works',
      content: (
        <div className={styles.stepContent}>
          <div className={styles.processSteps}>
            <div className={styles.processStep}>
              <div className={styles.processNumber}>1</div>
              <div className={styles.processLabel}>Upload Documents</div>
              <div className={styles.processDesc}>Share samples of your writing</div>
            </div>
            <div className={styles.processArrow}>→</div>
            <div className={styles.processStep}>
              <div className={styles.processNumber}>2</div>
              <div className={styles.processLabel}>Ursie Analyzes</div>
              <div className={styles.processDesc}>Patterns are extracted</div>
            </div>
            <div className={styles.processArrow}>→</div>
            <div className={styles.processStep}>
              <div className={styles.processNumber}>3</div>
              <div className={styles.processLabel}>Voice Captured</div>
              <div className={styles.processDesc}>Your style is learned</div>
            </div>
          </div>
          <p className={styles.hintText}>
            The more variety you upload, the better Ursie understands you.
          </p>
        </div>
      ),
    },
    {
      title: 'What Should You Upload?',
      content: (
        <div className={styles.stepContent}>
          <div className={styles.uploadTypes}>
            <div className={styles.uploadType}>
              <span className={styles.typeAbbrev}>PRO</span>
              <div className={styles.typeInfo}>
                <div className={styles.typeName}>Professional/Business</div>
                <div className={styles.typeExamples}>Work emails, reports, LinkedIn posts</div>
              </div>
            </div>
            <div className={styles.uploadType}>
              <span className={styles.typeAbbrev}>ACA</span>
              <div className={styles.typeInfo}>
                <div className={styles.typeName}>Academic Writing</div>
                <div className={styles.typeExamples}>Essays, research papers, assignments</div>
              </div>
            </div>
            <div className={styles.uploadType}>
              <span className={styles.typeAbbrev}>CRE</span>
              <div className={styles.typeInfo}>
                <div className={styles.typeName}>Creative Writing</div>
                <div className={styles.typeExamples}>Stories, blogs, personal writing</div>
              </div>
            </div>
            <div className={styles.uploadType}>
              <span className={styles.typeAbbrev}>PER</span>
              <div className={styles.typeInfo}>
                <div className={styles.typeName}>Personal/Casual</div>
                <div className={styles.typeExamples}>Journals, letters, reflections</div>
              </div>
            </div>
            <div className={styles.uploadType}>
              <span className={styles.typeAbbrev}>TEC</span>
              <div className={styles.typeInfo}>
                <div className={styles.typeName}>Technical Documentation</div>
                <div className={styles.typeExamples}>Guides, specs, documentation</div>
              </div>
            </div>
          </div>
          <p className={styles.hintText}>
            Aim for 3-5 documents with 50+ words each for best results.
          </p>
        </div>
      ),
    },
    {
      title: 'Building Your Voice',
      content: (
        <div className={styles.stepContent}>
          <div className={styles.confidenceMeter}>
            <div className={styles.meterVisual}>
              <div className={styles.meterBar}>
                <div className={`${styles.meterSegment} ${styles.seg1}`} />
                <div className={`${styles.meterSegment} ${styles.seg2}`} />
                <div className={`${styles.meterSegment} ${styles.seg3}`} />
                <div className={`${styles.meterSegment} ${styles.seg4}`} />
                <div className={`${styles.meterSegment} ${styles.seg5}`} />
              </div>
            </div>
            <div className={styles.meterLegend}>
              <div className={styles.legendItem}>
                <span className={`${styles.legendDot} ${styles.dot1}`} />
                <span className={styles.legendLabel}>0-24%</span>
                <span className={styles.legendName}>Initializing</span>
              </div>
              <div className={styles.legendItem}>
                <span className={`${styles.legendDot} ${styles.dot2}`} />
                <span className={styles.legendLabel}>25-44%</span>
                <span className={styles.legendName}>Learning</span>
              </div>
              <div className={styles.legendItem}>
                <span className={`${styles.legendDot} ${styles.dot3}`} />
                <span className={styles.legendLabel}>45-64%</span>
                <span className={styles.legendName}>Developing</span>
              </div>
              <div className={`${styles.legendItem} ${styles.legendItemHighlight}`}>
                <span className={`${styles.legendDot} ${styles.dot4}`} />
                <span className={styles.legendLabel}>65-84%</span>
                <span className={styles.legendName}>Confident</span>
              </div>
              <div className={styles.legendItem}>
                <span className={`${styles.legendDot} ${styles.dot5}`} />
                <span className={styles.legendLabel}>85-100%</span>
                <span className={styles.legendName}>Mastered</span>
              </div>
            </div>
          </div>
          <p className={styles.hintText}>
            At 65%+, your voice is ready for use across all ThinkWrite studios.
          </p>
        </div>
      ),
    },
    {
      title: 'Ready to Begin?',
      content: (
        <div className={`${styles.stepContent} ${styles.finalStep}`}>
          <p className={styles.mainText}>
            Start building your voice profile by uploading your first document.
            Ursie will begin learning your unique writing style immediately.
          </p>
          <div className={styles.ctaSection}>
            <button className={styles.btnPrimary} onClick={handleUpload}>
              Upload Your First Document
            </button>
            <button className={styles.btnSecondary} onClick={handleDismiss}>
              I'll explore first
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
              className={`${styles.dot} ${index === currentStep ? styles.dotActive : ''} ${
                index < currentStep ? styles.dotCompleted : ''
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
