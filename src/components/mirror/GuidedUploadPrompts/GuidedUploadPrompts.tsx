"use client";

import styles from "./GuidedUploadPrompts.module.css";
import type { Chamber } from "@/lib/mirror-mode/writingTypes";
import type { ChamberStatus } from "@/lib/mirror/voiceProfileStatus";

type UploadGuidance = {
  headline: string;
  suggestions: string[];
  avoid: string;
};

const uploadPrompts: Record<Chamber, UploadGuidance> = {
  career: {
    headline: "What works best for your career voice",
    suggestions: [
      "A cover letter you wrote yourself, not edited by someone else",
      "A performance review or self-evaluation you authored",
      "A professional email you felt represented you well",
      "A LinkedIn summary or bio in your own words",
    ],
    avoid: "Avoid job descriptions, templates, or anything written by HR.",
  },
  academic: {
    headline: "What works best for your academic voice",
    suggestions: [
      "An essay or paper you wrote without heavy editing",
      "A discussion board post or reflection",
      "A personal statement or application essay",
      "Notes or summaries you wrote in your own words",
    ],
    avoid:
      "Avoid heavily edited final drafts. Earlier drafts capture your real voice better.",
  },
  creative: {
    headline: "What works best for your creative voice",
    suggestions: [
      "Fiction, poetry, or creative nonfiction you wrote freely",
      "A journal entry or personal essay",
      "Blog posts or creative writing exercises",
      "Anything written without rules or constraints",
    ],
    avoid:
      "Avoid pieces written to a strict prompt or rubric. They constrain your natural voice.",
  },
  general: {
    headline: "What works best for your general voice",
    suggestions: [
      "Text messages or casual emails in your natural tone",
      "A personal message or letter to someone you know",
      "Social media posts written in your own voice",
      "Anything informal where you were not editing yourself heavily",
    ],
    avoid:
      "The less formal the better. Mirror Mode learns fastest from unguarded writing.",
  },
};

type Props = {
  chamber: Chamber;
  documentCount: number;
  status: ChamberStatus;
};

export default function GuidedUploadPrompts({
  chamber,
  documentCount,
  status,
}: Props) {
  const guidance = uploadPrompts[chamber];
  const collapsed = documentCount >= 3;
  if (status.state === "strong") return null;

  return (
    <section className={styles.card}>
      {collapsed ? (
        <p className={styles.collapsed}>What to upload for best results</p>
      ) : (
        <>
          <h3 className={styles.headline}>{guidance.headline}</h3>
          <ul className={styles.list}>
            {guidance.suggestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className={styles.avoid}>{guidance.avoid}</p>
        </>
      )}
    </section>
  );
}
