import type { SupabaseClient } from "@supabase/supabase-js";
import { type VoiceFingerprint } from "@/lib/mirror-core/voiceAnalysis";
import {
  getContextMemoryForSubcategory,
} from "@/lib/mirror-core/contextMemoryService";
import {
  type ContextMemoryEntry,
  getInheritanceBlend,
  getSubcategory,
  type InheritanceBlend,
  type MirrorChamber,
} from "@/lib/mirror-mode/subcategoryService";

export const VOICE_GENERATION_CONFIDENCE_THRESHOLD = 25;

export type VoiceToneOverride = "match" | "formal" | "casual";
export type VoiceLength = "short" | "medium" | "long";
export type VoiceGenerationOptions = {
  userId: string;
  chamber: string;
  subcategoryId?: string;
  toneOverride: VoiceToneOverride;
  supabase: SupabaseClient;
};

export type SubcategoryVoiceGenerationContext = {
  systemPrompt: string;
  confidenceContext: string | null;
  blendedFingerprint: VoiceFingerprint;
  threshold: InheritanceBlend["threshold"];
  contextFacts: string[];
};

export function buildVoiceSystemPrompt(
  fp: VoiceFingerprint,
  toneOverride: VoiceToneOverride
): string {
  const voiceTraits = buildDetailedVoiceDescription(fp);

  let toneInstruction = "";
  if (toneOverride === "formal") {
    toneInstruction =
      "\n\nIMPORTANT: For this specific request, lean MORE FORMAL than the user's typical style, but keep their other voice characteristics.";
  } else if (toneOverride === "casual") {
    toneInstruction =
      "\n\nIMPORTANT: For this specific request, lean MORE CASUAL than the user's typical style, but keep their other voice characteristics.";
  }

  return `You are a writing assistant specialized in voice matching. Your job is to generate text that sounds EXACTLY like a specific person wrote it.

═══════════════════════════════════════════════════════════════
THE USER'S WRITING VOICE - MATCH THIS PRECISELY
═══════════════════════════════════════════════════════════════

${voiceTraits}

═══════════════════════════════════════════════════════════════
VOICE MATCHING RULES
═══════════════════════════════════════════════════════════════

1. SENTENCE STRUCTURE: Match their average sentence length and variation pattern exactly
2. VOCABULARY: Use words at their complexity level - don't simplify or overcomplicate
3. PUNCTUATION: Mirror their punctuation habits (dashes, exclamations, questions, etc.)
4. TONE: Match their formality level and assertiveness
5. PRONOUNS: If they use "I/me/my" frequently, do the same. If they're impersonal, stay impersonal.
6. CONTRACTIONS: Use them if they do, avoid them if they don't
7. TRANSITIONS: Use their style of connecting ideas

DO NOT:
- Add personality traits they don't have
- Make the writing "better" - match their actual style
- Add exclamation marks if they rarely use them
- Use fancy vocabulary if they prefer simple words
- Hedge if they're assertive, or vice versa

The goal is for the user to read this and think "I could have written that myself."${toneInstruction}`;
}

function isMirrorChamber(value: string): value is MirrorChamber {
  return value === "career" || value === "academic" || value === "creative" || value === "general";
}

function weightedNumber(parent: number, subcategory: number, parentWeight: number, subcategoryWeight: number) {
  return Number((parent * parentWeight + subcategory * subcategoryWeight).toFixed(4));
}

function blendStringArrays(
  parent: string[],
  subcategory: string[],
  parentWeight: number,
  subcategoryWeight: number
): string[] {
  if (subcategoryWeight === 0) {
    return [...parent];
  }
  if (parentWeight === 0) {
    return [...subcategory];
  }

  const primary = subcategoryWeight >= parentWeight ? subcategory : parent;
  const secondary = subcategoryWeight >= parentWeight ? parent : subcategory;
  return [...new Set([...primary, ...secondary])];
}

export function blendVoiceFingerprints(
  parent: VoiceFingerprint,
  subcategory: VoiceFingerprint,
  blend: InheritanceBlend
): VoiceFingerprint {
  if (blend.parentWeight === 1 && blend.subcategoryWeight === 0) {
    return parent;
  }

  return {
    vocabulary: {
      uniqueWordCount: Math.round(
        weightedNumber(
          parent.vocabulary.uniqueWordCount,
          subcategory.vocabulary.uniqueWordCount,
          blend.parentWeight,
          blend.subcategoryWeight
        )
      ),
      avgWordLength: weightedNumber(
        parent.vocabulary.avgWordLength,
        subcategory.vocabulary.avgWordLength,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      complexWordRatio: weightedNumber(
        parent.vocabulary.complexWordRatio,
        subcategory.vocabulary.complexWordRatio,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      contractionRatio: weightedNumber(
        parent.vocabulary.contractionRatio,
        subcategory.vocabulary.contractionRatio,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      topWords: blendStringArrays(
        parent.vocabulary.topWords,
        subcategory.vocabulary.topWords,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      rarityScore: weightedNumber(
        parent.vocabulary.rarityScore,
        subcategory.vocabulary.rarityScore,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
    },
    rhythm: {
      avgSentenceLength: weightedNumber(
        parent.rhythm.avgSentenceLength,
        subcategory.rhythm.avgSentenceLength,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      sentenceVariation: weightedNumber(
        parent.rhythm.sentenceVariation,
        subcategory.rhythm.sentenceVariation,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      shortSentenceRatio: weightedNumber(
        parent.rhythm.shortSentenceRatio,
        subcategory.rhythm.shortSentenceRatio,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      longSentenceRatio: weightedNumber(
        parent.rhythm.longSentenceRatio,
        subcategory.rhythm.longSentenceRatio,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      avgParagraphLength: weightedNumber(
        parent.rhythm.avgParagraphLength,
        subcategory.rhythm.avgParagraphLength,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      paragraphVariation: weightedNumber(
        parent.rhythm.paragraphVariation,
        subcategory.rhythm.paragraphVariation,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
    },
    punctuation: {
      exclamationRate: weightedNumber(
        parent.punctuation.exclamationRate,
        subcategory.punctuation.exclamationRate,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      questionRate: weightedNumber(
        parent.punctuation.questionRate,
        subcategory.punctuation.questionRate,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      semicolonRate: weightedNumber(
        parent.punctuation.semicolonRate,
        subcategory.punctuation.semicolonRate,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      dashRate: weightedNumber(
        parent.punctuation.dashRate,
        subcategory.punctuation.dashRate,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      ellipsisRate: weightedNumber(
        parent.punctuation.ellipsisRate,
        subcategory.punctuation.ellipsisRate,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      colonRate: weightedNumber(
        parent.punctuation.colonRate,
        subcategory.punctuation.colonRate,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      commaRate: weightedNumber(
        parent.punctuation.commaRate,
        subcategory.punctuation.commaRate,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
    },
    voice: {
      hedgeDensity: weightedNumber(
        parent.voice.hedgeDensity,
        subcategory.voice.hedgeDensity,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      qualifierDensity: weightedNumber(
        parent.voice.qualifierDensity,
        subcategory.voice.qualifierDensity,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      assertiveDensity: weightedNumber(
        parent.voice.assertiveDensity,
        subcategory.voice.assertiveDensity,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      personalPronounRate: weightedNumber(
        parent.voice.personalPronounRate,
        subcategory.voice.personalPronounRate,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      formalityScore: weightedNumber(
        parent.voice.formalityScore,
        subcategory.voice.formalityScore,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      activeVoiceRatio: weightedNumber(
        parent.voice.activeVoiceRatio,
        subcategory.voice.activeVoiceRatio,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
    },
    rhetoric: {
      questionOpenerRate: weightedNumber(
        parent.rhetoric.questionOpenerRate,
        subcategory.rhetoric.questionOpenerRate,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      transitionWordRate: weightedNumber(
        parent.rhetoric.transitionWordRate,
        subcategory.rhetoric.transitionWordRate,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      listUsageRate: weightedNumber(
        parent.rhetoric.listUsageRate,
        subcategory.rhetoric.listUsageRate,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      exampleUsageRate: weightedNumber(
        parent.rhetoric.exampleUsageRate,
        subcategory.rhetoric.exampleUsageRate,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
      emphasisPatterns: blendStringArrays(
        parent.rhetoric.emphasisPatterns,
        subcategory.rhetoric.emphasisPatterns,
        blend.parentWeight,
        blend.subcategoryWeight
      ),
    },
    meta: {
      sampleWordCount: Math.round(
        weightedNumber(
          parent.meta.sampleWordCount,
          subcategory.meta.sampleWordCount,
          blend.parentWeight,
          blend.subcategoryWeight
        )
      ),
      sampleSentenceCount: Math.round(
        weightedNumber(
          parent.meta.sampleSentenceCount,
          subcategory.meta.sampleSentenceCount,
          blend.parentWeight,
          blend.subcategoryWeight
        )
      ),
      extractedAt:
        blend.subcategoryWeight >= blend.parentWeight
          ? subcategory.meta.extractedAt
          : parent.meta.extractedAt,
      version:
        blend.subcategoryWeight >= blend.parentWeight
          ? subcategory.meta.version
          : parent.meta.version,
    },
  };
}

export function formatContextMemoryFacts(entries: ContextMemoryEntry[]): string[] {
  return entries
    .map((entry) => {
      const attributes =
        entry.attributes && typeof entry.attributes === "object" && !Array.isArray(entry.attributes)
          ? (entry.attributes as Record<string, unknown>)
          : {};
      const parts: string[] = [];

      if (entry.entity_type === "person") {
        let fact = entry.entity_name;
        if (typeof attributes.role === "string" && attributes.role.trim()) {
          fact += ` is ${attributes.role.trim()}`;
        }
        if (typeof attributes.company === "string" && attributes.company.trim()) {
          fact += ` at ${attributes.company.trim()}`;
        }
        if (typeof attributes.pronouns === "string" && attributes.pronouns.trim()) {
          fact += `, ${attributes.pronouns.trim()}`;
        }
        return fact;
      }

      if (typeof attributes.role === "string" && attributes.role.trim()) {
        parts.push(attributes.role.trim());
      }
      if (typeof attributes.company === "string" && attributes.company.trim()) {
        parts.push(`at ${attributes.company.trim()}`);
      }

      return parts.length > 0
        ? `${entry.entity_name} ${parts.join(" ")}`
        : entry.entity_name;
    })
    .filter((fact) => fact.trim().length > 0);
}

function buildDevelopingSubcategoryContext(subcategoryName: string, chamber: string) {
  return `I know the outline of your ${subcategoryName} voice, but I am still leaning on your ${chamber} foundation while it sharpens. Give me more real writing in that context and this will get cleaner.`;
}

export async function buildSubcategoryVoiceGenerationContext(
  options: VoiceGenerationOptions
): Promise<SubcategoryVoiceGenerationContext | null> {
  const { userId, chamber, subcategoryId, toneOverride, supabase } = options;
  if (!subcategoryId) {
    return null;
  }

  try {
    const subcategory = await getSubcategory(userId, subcategoryId, supabase);
    if (!subcategory || !isMirrorChamber(subcategory.parent_chamber) || subcategory.parent_chamber !== chamber) {
      return null;
    }

    const { data: chamberRow, error: chamberError } = await supabase
      .from("voice_chambers")
      .select("aggregate_fingerprint")
      .eq("user_id", userId)
      .eq("chamber", subcategory.parent_chamber)
      .maybeSingle();

    if (chamberError) {
      throw new Error(chamberError.message);
    }
    if (!chamberRow?.aggregate_fingerprint) {
      return null;
    }

    const parentFingerprint = chamberRow.aggregate_fingerprint as VoiceFingerprint;
    const subcategoryFingerprint = subcategory.aggregate_fingerprint as VoiceFingerprint;
    const blend = getInheritanceBlend(subcategory.document_count);
    const blendedFingerprint =
      blend.parentWeight === 1
        ? parentFingerprint
        : blendVoiceFingerprints(parentFingerprint, subcategoryFingerprint, blend);
    const contextEntries = await getContextMemoryForSubcategory(userId, subcategoryId, supabase);
    const contextFacts = formatContextMemoryFacts(contextEntries);
    const systemPrompt = [
      buildVoiceSystemPrompt(blendedFingerprint, toneOverride),
      contextFacts.length > 0
        ? `Known context for this writing: [${contextFacts.join("; ")}]`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      systemPrompt,
      confidenceContext:
        blend.threshold === "developing"
          ? buildDevelopingSubcategoryContext(subcategory.name, subcategory.parent_chamber)
          : null,
      blendedFingerprint,
      threshold: blend.threshold,
      contextFacts,
    };
  } catch (error) {
    console.error("[Voice Generation] subcategory context failed:", error);
    return null;
  }
}

function buildDetailedVoiceDescription(fp: VoiceFingerprint): string {
  const sections: string[] = [];

  const sentenceStyle = [];
  if (fp.rhythm.avgSentenceLength > 22) {
    sentenceStyle.push(
      "Writes in longer, complex sentences (avg ~" + Math.round(fp.rhythm.avgSentenceLength) + " words)"
    );
  } else if (fp.rhythm.avgSentenceLength < 12) {
    sentenceStyle.push(
      "Writes in short, punchy sentences (avg ~" + Math.round(fp.rhythm.avgSentenceLength) + " words)"
    );
  } else {
    sentenceStyle.push(
      "Uses medium-length sentences (avg ~" + Math.round(fp.rhythm.avgSentenceLength) + " words)"
    );
  }

  if (fp.rhythm.sentenceVariation > 8) {
    sentenceStyle.push("Varies sentence length significantly for rhythm");
  } else if (fp.rhythm.sentenceVariation < 3) {
    sentenceStyle.push("Keeps sentence lengths consistent");
  }

  if (fp.rhythm.shortSentenceRatio > 0.25) {
    sentenceStyle.push("Uses short sentences for emphasis");
  }
  sections.push("SENTENCE STRUCTURE:\n" + sentenceStyle.map((s) => "• " + s).join("\n"));

  const vocabStyle = [];
  if (fp.vocabulary.complexWordRatio > 0.18) {
    vocabStyle.push("Uses sophisticated, complex vocabulary");
  } else if (fp.vocabulary.complexWordRatio < 0.08) {
    vocabStyle.push("Prefers simple, accessible words");
  } else {
    vocabStyle.push("Uses moderately complex vocabulary");
  }

  if (fp.vocabulary.contractionRatio > 0.02) {
    vocabStyle.push("Uses contractions freely (don't, won't, it's)");
  } else if (fp.vocabulary.contractionRatio < 0.005) {
    vocabStyle.push("Avoids contractions (writes \"do not\" instead of \"don't\")");
  }

  if (fp.vocabulary.topWords && fp.vocabulary.topWords.length > 0) {
    vocabStyle.push("Frequently uses words like: " + fp.vocabulary.topWords.slice(0, 8).join(", "));
  }
  sections.push("VOCABULARY:\n" + vocabStyle.map((s) => "• " + s).join("\n"));

  const toneStyle = [];
  if (fp.voice.formalityScore > 0.7) {
    toneStyle.push("Very formal, professional tone");
  } else if (fp.voice.formalityScore > 0.5) {
    toneStyle.push("Moderately formal tone");
  } else if (fp.voice.formalityScore > 0.3) {
    toneStyle.push("Conversational, approachable tone");
  } else {
    toneStyle.push("Casual, informal tone");
  }

  if (fp.voice.assertiveDensity > 0.01) {
    toneStyle.push("Makes direct, confident assertions (\"clearly\", \"obviously\", \"definitely\")");
  } else if (fp.voice.hedgeDensity > 0.02) {
    toneStyle.push("Tends to hedge and qualify (\"maybe\", \"perhaps\", \"I think\")");
  }

  if (fp.voice.personalPronounRate > 0.05) {
    toneStyle.push("Writes with strong personal voice (frequent \"I\", \"me\", \"my\")");
  } else if (fp.voice.personalPronounRate < 0.01) {
    toneStyle.push("Uses impersonal, third-person perspective");
  }

  if (fp.voice.activeVoiceRatio > 0.7) {
    toneStyle.push("Prefers active voice");
  } else if (fp.voice.activeVoiceRatio < 0.5) {
    toneStyle.push("Uses passive voice frequently");
  }
  sections.push("TONE & VOICE:\n" + toneStyle.map((s) => "• " + s).join("\n"));

  const punctStyle = [];
  if (fp.punctuation.exclamationRate > 5) {
    punctStyle.push("Uses exclamation marks expressively!");
  } else if (fp.punctuation.exclamationRate < 1) {
    punctStyle.push("Rarely uses exclamation marks");
  }

  if (fp.punctuation.questionRate > 10) {
    punctStyle.push("Frequently poses rhetorical questions");
  }

  if (fp.punctuation.dashRate > 5) {
    punctStyle.push("Uses em-dashes for emphasis and asides");
  }

  if (fp.punctuation.semicolonRate > 3) {
    punctStyle.push("Uses semicolons to connect related ideas");
  }

  if (fp.punctuation.ellipsisRate > 2) {
    punctStyle.push("Uses ellipses for trailing thoughts...");
  }

  if (punctStyle.length > 0) {
    sections.push("PUNCTUATION HABITS:\n" + punctStyle.map((s) => "• " + s).join("\n"));
  }

  const rhetStyle = [];
  if (fp.rhetoric.transitionWordRate > 0.15) {
    rhetStyle.push("Connects ideas with transitions (however, therefore, moreover)");
  }

  if (fp.rhetoric.questionOpenerRate > 0.1) {
    rhetStyle.push("Opens sections with questions to engage readers");
  }

  if (fp.rhetoric.listUsageRate > 0.05) {
    rhetStyle.push("Uses lists and enumerations");
  }

  if (fp.rhetoric.exampleUsageRate > 0.03) {
    rhetStyle.push("Illustrates points with examples");
  }

  if (rhetStyle.length > 0) {
    sections.push("RHETORICAL PATTERNS:\n" + rhetStyle.map((s) => "• " + s).join("\n"));
  }

  return sections.join("\n\n");
}

export function getMaxTokens(length: VoiceLength): number {
  switch (length) {
    case "short":
      return 300;
    case "medium":
      return 600;
    case "long":
      return 1200;
    default:
      return 600;
  }
}
