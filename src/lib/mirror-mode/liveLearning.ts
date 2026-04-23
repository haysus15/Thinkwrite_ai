// src/lib/mirror-mode/liveLearning.ts
// Utility for integrating live voice learning into any feature
// Fire-and-forget - doesn't block the calling feature

import {
  isProfileEligible,
  type SourceAuthority,
} from "@/lib/mirror-core/sourceAuthority";
import {
  shouldIngestForProfile,
} from "@/lib/mirror-core/ingestionPolicy";

export type LearningSource =
  | 'cover-letter'
  | 'lex-chat'
  | 'coding-review'
  | 'resume-upload'
  | 'resume-builder'
  | 'tailored-resume'
  | 'manual-upload'
  | 'other';

export type LearnOptions = {
  userId: string;
  text: string;
  source: LearningSource;
  sourceAuthority: SourceAuthority;
  metadata?: {
    documentId?: string;
    title?: string;
    context?: string;
    writingType?: string;
  };
};

const SOURCE_NAME: Record<LearningSource, string> = {
  'cover-letter': 'Cover Letter',
  'lex-chat': 'Lex Chat',
  'coding-review': 'Coding Review',
  'resume-upload': 'Resume Upload',
  'resume-builder': 'Resume Builder',
  'tailored-resume': 'Tailored Resume',
  'manual-upload': 'Manual Upload',
  'other': 'Writing Sample',
};

const SOURCE_WRITING_TYPE: Record<LearningSource, string> = {
  'cover-letter': 'professional',
  'lex-chat': 'general',
  'coding-review': 'academic',
  'resume-upload': 'professional',
  'resume-builder': 'professional',
  'tailored-resume': 'professional',
  'manual-upload': 'general',
  'other': 'general',
};

/**
 * Send text to Mirror Mode for voice learning
 * This is fire-and-forget - returns immediately without waiting
 *
 * @example
 * // In cover letter generation:
 * learnFromText({
 *   userId: user.id,
 *   text: generatedCoverLetter,
 *   source: 'cover-letter',
 *   metadata: { title: 'Cover letter for Acme Corp' }
 * });
 *
 * @example
 * // In Lex chat:
 * learnFromText({
 *   userId,
 *   text: userMessage,
 *   source: 'lex-chat',
 *   metadata: { context: 'career-assessment' }
 * });
 */
export function learnFromText(options: LearnOptions): void {
  const { userId, text, source, sourceAuthority, metadata } = options;

  // Don't block - fire and forget
  fetch('/api/mirror-mode/live-learn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, text, source, sourceAuthority, metadata }),
  }).catch((err) => {
    // Silent fail - learning shouldn't break main features
    console.log('Mirror Mode learning skipped:', err.message);
  });
}

/**
 * Server-side version for API routes
 * Uses absolute URL for server-to-server calls
 */
export async function learnFromTextServer(
  options: LearnOptions,
  baseUrl?: string
): Promise<{ learned: boolean; error?: string }> {
  const { userId, text, source, sourceAuthority, metadata } = options;

  try {
    // For server-side, we need the full URL
    const url = baseUrl
      ? `${baseUrl}/api/mirror-mode/live-learn`
      : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/mirror-mode/live-learn`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, text, source, sourceAuthority, metadata }),
    });

    const data = await response.json();
    return { learned: data.learned || false, error: data.error };
  } catch (err: any) {
    console.log('Mirror Mode server learning skipped:', err.message);
    return { learned: false, error: err.message };
  }
}

/**
 * Direct learning function that can be called from API routes
 * Bypasses HTTP to reduce latency
 */
export async function learnFromTextDirect(
  options: LearnOptions
): Promise<{
  learned: boolean;
  confidenceLevel?: number;
  confidenceGain?: number;
  error?: string;
}> {
  // Dynamic import to avoid circular dependencies
  const { createClient } = await import('@supabase/supabase-js');
  const { extractVoiceFingerprint } = await import('@/lib/mirror-core/voiceAnalysis');
  const { aggregateFingerprints, getConfidenceLabel } = await import('@/lib/mirror-core/voiceAggregation');
  const { mapWritingTypeToChamber } = await import('@/lib/mirror-core/writingTypes');

  const { userId, text, source, sourceAuthority, metadata } = options;

  try {
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    if (!isProfileEligible(sourceAuthority)) {
      return { learned: false, error: `Source excluded from profile: ${sourceAuthority}` };
    }
    const ingestionDecision = shouldIngestForProfile(wordCount, sourceAuthority);
    if (!ingestionDecision.eligible) {
      return { learned: false, error: ingestionDecision.reason };
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check settings
    let isEnabled = true;
    try {
      const { data: settings, error: settingsError } = await supabase
        .from('mirror_mode_settings')
        .select('live_learning_enabled, learning_sources')
        .eq('user_id', userId)
        .single();
      if (!settingsError) {
        isEnabled = settings?.live_learning_enabled ?? true;
      }
    } catch {
      isEnabled = true;
    }
    if (!isEnabled) {
      return { learned: false, error: 'Live learning disabled' };
    }

    // Extract fingerprint
    const fingerprint = extractVoiceFingerprint(text);

    // Get existing profile
    const { data: existingRow } = await supabase
      .from('voice_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    let existingProfile = null;
    if (existingRow) {
      existingProfile = {
        userId: existingRow.user_id,
        aggregateFingerprint: existingRow.aggregate_fingerprint,
        confidenceLevel: existingRow.confidence_level || 0,
        documentCount: existingRow.document_count || 0,
        totalWordCount: existingRow.total_word_count || 0,
        lastTrainedAt: existingRow.last_trained_at || new Date().toISOString(),
        evolutionHistory: existingRow.evolution_history || [],
      };
    }

    // Aggregate
    const documentId = metadata?.documentId || `live-${source}-${Date.now()}`;
    const documentMeta = {
      fileName: metadata?.title || SOURCE_NAME[source],
      writingType: metadata?.writingType || SOURCE_WRITING_TYPE[source],
      wordCount,
    };
    const updatedProfile = aggregateFingerprints(existingProfile, fingerprint, documentId, documentMeta);
    updatedProfile.userId = userId;

    // Save
    const { error: upsertError } = await supabase
      .from('voice_profiles')
      .upsert({
        user_id: userId,
        aggregate_fingerprint: updatedProfile.aggregateFingerprint,
        confidence_level: updatedProfile.confidenceLevel,
        document_count: updatedProfile.documentCount,
        total_word_count: updatedProfile.totalWordCount,
        last_trained_at: updatedProfile.lastTrainedAt,
        evolution_history: updatedProfile.evolutionHistory,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (upsertError) {
      return { learned: false, error: upsertError.message };
    }

    // Best-effort chamber profile update
    try {
      const chamber = mapWritingTypeToChamber(documentMeta.writingType);
      const { data: existingChamberRow } = await supabase
        .from('voice_chambers')
        .select('*')
        .eq('user_id', userId)
        .eq('chamber', chamber)
        .maybeSingle();

      let existingChamberProfile = null;
      if (existingChamberRow) {
        existingChamberProfile = {
          userId: existingChamberRow.user_id,
          aggregateFingerprint: existingChamberRow.aggregate_fingerprint,
          confidenceLevel: existingChamberRow.confidence_level || 0,
          documentCount: existingChamberRow.document_count || 0,
          totalWordCount: existingChamberRow.total_word_count || 0,
          lastTrainedAt: existingChamberRow.last_trained_at || new Date().toISOString(),
          evolutionHistory: existingChamberRow.evolution_history || [],
        };
      }

      const updatedChamberProfile = aggregateFingerprints(
        existingChamberProfile,
        fingerprint,
        documentId,
        documentMeta
      );
      updatedChamberProfile.userId = userId;

      await supabase
        .from('voice_chambers')
        .upsert({
          user_id: userId,
          chamber,
          aggregate_fingerprint: updatedChamberProfile.aggregateFingerprint,
          confidence_level: updatedChamberProfile.confidenceLevel,
          document_count: updatedChamberProfile.documentCount,
          total_word_count: updatedChamberProfile.totalWordCount,
          last_trained_at: updatedChamberProfile.lastTrainedAt,
          evolution_history: updatedChamberProfile.evolutionHistory,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,chamber' });

      await supabase
        .from('voice_chambers')
        .upsert({
          user_id: userId,
          chamber: 'overall',
          aggregate_fingerprint: updatedProfile.aggregateFingerprint,
          confidence_level: updatedProfile.confidenceLevel,
          document_count: updatedProfile.documentCount,
          total_word_count: updatedProfile.totalWordCount,
          last_trained_at: updatedProfile.lastTrainedAt,
          evolution_history: updatedProfile.evolutionHistory,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,chamber' });
    } catch (err: any) {
      if (!String(err?.message || '').includes('does not exist')) {
        console.warn('Chamber profile update skipped:', err?.message || err);
      }
    }

    // Log activity
    try {
      await supabase.from('mirror_learning_activity').insert({
        user_id: userId,
        source,
        word_count: wordCount,
        document_id: metadata?.documentId || null,
        title: metadata?.title || null,
        context: metadata?.context || null,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      // Silent fail
    }

    const confidenceGain = existingProfile
      ? updatedProfile.confidenceLevel - existingProfile.confidenceLevel
      : updatedProfile.confidenceLevel;

    return {
      learned: true,
      confidenceLevel: updatedProfile.confidenceLevel,
      confidenceGain,
    };

  } catch (err: any) {
    console.error('Direct learning error:', err);
    return { learned: false, error: err.message };
  }
}
