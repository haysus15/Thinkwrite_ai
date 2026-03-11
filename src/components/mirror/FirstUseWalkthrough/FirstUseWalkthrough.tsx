"use client";

import { useMemo, useState } from "react";
import styles from "./FirstUseWalkthrough.module.css";

type WalkStep = {
  id: "chamber-select" | "roadmap" | "first-upload" | "complete";
  heading: string;
  body: string;
  action: string | null;
  highlight: string | null;
};

const walkthroughSteps: WalkStep[] = [
  {
    id: "chamber-select",
    heading: "Choose where to start",
    body: "Mirror Mode learns your voice separately for different contexts. Pick the one most relevant to you right now.",
    action: "Select a chamber",
    highlight: "chamber-tabs",
  },
  {
    id: "roadmap",
    heading: "How this works",
    body: "Mirror Mode builds your profile in stages. Your first upload starts the process. Results improve with every addition.",
    action: null,
    highlight: "confidence-roadmap",
  },
  {
    id: "first-upload",
    heading: "Add your first sample",
    body: "Upload something you wrote naturally. A cover letter, an essay, a message. Anything in your real voice.",
    action: "Upload a document",
    highlight: "upload-dropzone",
  },
  {
    id: "complete",
    heading: "Mirror Mode is learning",
    body: "Your first sample is being analyzed. Add more when you have them. The profile strengthens with each one.",
    action: null,
    highlight: null,
  },
];

type Props = {
  visible: boolean;
  hasSelectedChamber: boolean;
  hasFirstUpload: boolean;
  onSkip: () => void;
  onRequestUploadFocus: () => void;
};

export default function FirstUseWalkthrough({
  visible,
  hasSelectedChamber,
  hasFirstUpload,
  onSkip,
  onRequestUploadFocus,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = walkthroughSteps[stepIndex];

  const canAdvance = useMemo(() => {
    if (step.id === "chamber-select") return hasSelectedChamber;
    if (step.id === "first-upload") return hasFirstUpload;
    return true;
  }, [step.id, hasSelectedChamber, hasFirstUpload]);

  if (!visible) return null;

  return (
    <section className={styles.banner}>
      <div className={styles.left}>
        <p className={styles.kicker}>Setup guide</p>
        <h3 className={styles.heading}>{step.heading}</h3>
        <p className={styles.body}>{step.body}</p>
        {step.action && <p className={styles.action}>Action: {step.action}</p>}
        {step.highlight && <p className={styles.highlight}>Focus: {step.highlight}</p>}
      </div>
      <div className={styles.right}>
        {step.id === "first-upload" && (
          <button type="button" className={styles.secondary} onClick={onRequestUploadFocus}>
            Jump to upload
          </button>
        )}
        <button type="button" className={styles.secondary} onClick={onSkip}>
          Skip setup
        </button>
        {stepIndex < walkthroughSteps.length - 1 ? (
          <button
            type="button"
            className={styles.primary}
            disabled={!canAdvance}
            onClick={() => setStepIndex((value) => value + 1)}
          >
            Next
          </button>
        ) : (
          <button type="button" className={styles.primary} onClick={onSkip}>
            Finish
          </button>
        )}
      </div>
    </section>
  );
}
