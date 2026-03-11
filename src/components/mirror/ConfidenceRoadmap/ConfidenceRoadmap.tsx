"use client";

import styles from "./ConfidenceRoadmap.module.css";

interface RoadmapStage {
  stage: number;
  documentRange: string;
  capability: string;
}

const stages: RoadmapStage[] = [
  {
    stage: 1,
    documentRange: "1 document",
    capability: "Mirror Mode picks up your basic tone and register.",
  },
  {
    stage: 2,
    documentRange: "2-3 documents",
    capability: "Sentence structure and vocabulary patterns become visible.",
  },
  {
    stage: 3,
    documentRange: "3-4 documents",
    capability: "How you open and close ideas starts to take shape.",
  },
  {
    stage: 4,
    documentRange: "4-5 documents",
    capability: "Your rhythm and voice consistency become reliable.",
  },
  {
    stage: 5,
    documentRange: "5+ documents",
    capability: "Outputs consistently sound like you, not like AI.",
  },
];

type Props = {
  documentCount: number;
};

export default function ConfidenceRoadmap({ documentCount }: Props) {
  return (
    <section className={styles.roadmap} id="confidence-roadmap">
      <h3 className={styles.heading}>How Mirror Mode learns</h3>
      <p className={styles.subheading}>
        Your first upload begins the process. Results improve with each addition.
      </p>
      <div className={styles.timeline}>
        {stages.map((stage) => {
          const isActive = documentCount >= stage.stage;
          return (
            <div
              key={stage.stage}
              className={`${styles.stage} ${isActive ? styles.stageActive : ""}`}
            >
              <div className={styles.index}>{stage.stage}</div>
              <div>
                <p className={styles.range}>{stage.documentRange}</p>
                <p className={styles.capability}>{stage.capability}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
