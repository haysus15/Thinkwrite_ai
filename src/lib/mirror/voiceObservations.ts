import type { VoiceFingerprint } from "@/lib/mirror-core/voiceAnalysis";

function clampWordLength(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value * 10) / 10) : 0;
}

export function buildVoiceObservations(
  fingerprint: VoiceFingerprint | null | undefined
): string[] {
  if (!fingerprint) return [];

  const observations: string[] = [];
  const avgSentence = Math.round(fingerprint.rhythm.avgSentenceLength || 0);
  if (avgSentence > 0) {
    observations.push(`Your sentence length averages ${avgSentence} words.`);
  }

  const concreteBias =
    (fingerprint.vocabulary.complexWordRatio || 0) < 0.1
      ? "You favor concrete language over abstract wording."
      : "You use a higher share of abstract and technical language.";
  observations.push(concreteBias);

  if ((fingerprint.rhetoric.transitionWordRate || 0) > 0.2) {
    observations.push(
      "You often use transition phrases to connect ideas explicitly."
    );
  } else {
    observations.push(
      "You tend to move between ideas with minimal transition phrasing."
    );
  }

  const formality = fingerprint.voice.formalityScore || 0;
  if (formality >= 0.7) {
    observations.push("Your tone trends formal and controlled.");
  } else if (formality <= 0.35) {
    observations.push("Your tone trends conversational and direct.");
  } else {
    observations.push("Your tone stays balanced between formal and casual.");
  }

  const avgWordLength = clampWordLength(fingerprint.vocabulary.avgWordLength || 0);
  if (avgWordLength > 0) {
    observations.push(`Your average word length is ${avgWordLength} characters.`);
  }

  return observations.slice(0, 4);
}
