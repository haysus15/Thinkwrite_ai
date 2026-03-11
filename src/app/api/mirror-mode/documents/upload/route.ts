// src/app/api/mirror-mode/documents/upload/route.ts
// Document upload with automatic voice learning

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { extractTextFromFile } from '@/lib/mirror-mode/extractText';
import { extractVoiceFingerprint, describeVoice } from '@/lib/mirror-mode/voiceAnalysis';
import { 
  aggregateFingerprints, 
  getConfidenceLabel,
  type VoiceProfile 
} from '@/lib/mirror-mode/voiceAggregation';
import { isWritingType, mapWritingTypeToChamber } from '@/lib/mirror-mode/writingTypes';
import { getChamberStatus } from '@/lib/mirror/voiceProfileStatus';
import { buildVoiceObservations } from '@/lib/mirror/voiceObservations';
import { SOURCE_AUTHORITY } from '@/lib/mirror-mode/sourceAuthority';
import { shouldIngestForProfile } from '@/lib/mirror-mode/ingestionPolicy';

export const runtime = 'nodejs';

/**
 * POST /api/mirror-mode/documents/upload
 * 
 * Upload a document and automatically learn from it.
 * 
 * Form data:
 *   - file: File (required) - TXT, DOCX, or PDF
 *   - writingType: string (required) - "professional", "academic", "creative", "personal", "technical"
 *   - skipLearning: boolean (optional) - if true, upload without learning
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const writingType = (formData.get('writingType') as string) || null;
    const skipLearning = formData.get('skipLearning') === 'true';

    const { userId, error: authError } = await getAuthUser();
    if (authError || !userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // ---- VALIDATION ----
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!writingType || !isWritingType(writingType)) {
      return NextResponse.json(
        { success: false, error: 'Writing type is required' },
        { status: 400 }
      );
    }

    // File size validation (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large. Maximum size is 10MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.` },
        { status: 400 }
      );
    }

    // File type validation (PDF, DOCX, TXT only)
    const ALLOWED_TYPES = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only PDF, DOCX, and TXT files are allowed.' },
        { status: 400 }
      );
    }

    // ---- EXTRACT TEXT ----
    const extraction = await extractTextFromFile(file);
    
    if (extraction.ok === false) {
  return NextResponse.json(
    { success: false, error: extraction.error },
    { status: 400 }
  );
}

    const extractedText = extraction.ok ? extraction.text : '';
    const wordCount = extractedText.trim().split(/\s+/).filter(Boolean).length;

    // ---- UPLOAD FILE TO STORAGE ----
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    // ---- DETERMINE CURRENT EPOCH (BEST EFFORT) ----
    let currentEpochNumber = 1;
    try {
      const { data: epochRow } = await supabase
        .from('voice_profile_epochs')
        .select('epoch_number')
        .eq('user_id', userId)
        .is('ended_at', null)
        .order('epoch_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (epochRow?.epoch_number) currentEpochNumber = epochRow.epoch_number;
    } catch (err) {
      // If epochs table isn't present yet, default to epoch 1
    }

    // ---- CREATE DOCUMENT RECORD ----
    let insertPayload: Record<string, any> = {
      user_id: userId,
      file_name: file.name,
      mime_type: file.type || 'application/octet-stream',
      file_size: file.size,
      storage_path: null,
      writing_type: writingType,
      word_count: wordCount,
      status: 'uploaded',
      training_allowed: true,
      source_authority: SOURCE_AUTHORITY.USER_UPLOADED,
      excluded_from_profile: false,
      visibility_status: 'active',
      epoch_number: currentEpochNumber,
    };

    let { data: document, error: docError } = await supabase
      .from('mirror_documents')
      .insert(insertPayload)
      .select('id')
      .single();

    // If schema isn't upgraded yet, retry without new fields
    if (docError?.message?.includes('column') || docError?.message?.includes('visibility_status') || docError?.message?.includes('epoch_number')) {
      insertPayload = {
        user_id: userId,
        file_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        file_size: file.size,
        storage_path: null,
        writing_type: writingType,
        word_count: wordCount,
        status: 'uploaded',
        training_allowed: true,
        source_authority: SOURCE_AUTHORITY.USER_UPLOADED,
        excluded_from_profile: false,
      };
      ({ data: document, error: docError } = await supabase
        .from('mirror_documents')
        .insert(insertPayload)
        .select('id')
        .single());
    }

    if (docError || !document) {
      return NextResponse.json(
        { success: false, error: 'Failed to create document record', details: docError?.message },
        { status: 500 }
      );
    }

    const documentId = document.id;

    // ---- UPLOAD FILE TO STORAGE ----
    const storagePath = `${userId}/${documentId}/${safeFileName}`;
    const { error: storageError } = await supabase.storage
      .from('user-documents')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (storageError) {
      console.error('Storage upload error:', storageError);
      // Continue without storage - we still have the extracted text
    } else {
      await supabase
        .from('mirror_documents')
        .update({ storage_path: storagePath })
        .eq('id', documentId);
    }

    // ---- STORE EXTRACTED TEXT ----
    const { error: contentError } = await supabase
      .from('mirror_document_content')
      .insert({
        document_id: documentId,
        extracted_text: extractedText,
        extraction_method: extraction.method,
      });

    if (contentError) {
      console.error('Content storage error:', contentError);
      // Continue - document exists, content failed
    }

    // ---- VOICE LEARNING (unless skipped) ----
    let learningResult: any = null;

    const ingestionDecision = shouldIngestForProfile(
      wordCount,
      SOURCE_AUTHORITY.USER_UPLOADED
    );
    if (!skipLearning && ingestionDecision.eligible) {
      try {
        // Extract fingerprint from new document
        const newFingerprint = extractVoiceFingerprint(extractedText);

        // Store per-document fingerprint for document detail view
        await supabase
          .from('mirror_documents')
          .update({ document_fingerprint: newFingerprint })
          .eq('id', documentId);

        // Fetch existing voice profile
        const { data: existingRow } = await supabase
          .from('voice_profiles')
          .select('*')
          .eq('user_id', userId)
          .single();

        let existingProfile: VoiceProfile | null = null;
        const previousOverallConfidence = existingRow?.confidence_level || 0;
        const previousOverallDocs = existingRow?.document_count || 0;

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

        // Aggregate (THE LEARNING) with document metadata
        const updatedProfile = aggregateFingerprints(
          existingProfile,
          newFingerprint,
          documentId,
          {
            fileName: file.name,
            writingType,
            wordCount,
          }
        );
        updatedProfile.userId = userId;

        // Save updated profile (overall)
        await supabase
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
          }, {
            onConflict: 'user_id',
          });

        // Save chamber profile (best effort; table may not exist yet)
        let previousChamberConfidence = 0;
        let previousChamberDocs = 0;
        let newChamberConfidence = 0;
        let newChamberDocs = 0;
        const chamber = mapWritingTypeToChamber(writingType);
        try {
          const { data: existingChamberRow } = await supabase
            .from('voice_chambers')
            .select('*')
            .eq('user_id', userId)
            .eq('chamber', chamber)
            .maybeSingle();
          previousChamberConfidence = existingChamberRow?.confidence_level || 0;
          previousChamberDocs = existingChamberRow?.document_count || 0;
          newChamberConfidence = previousChamberConfidence;
          newChamberDocs = previousChamberDocs;

          let existingChamberProfile: VoiceProfile | null = null;
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
            newFingerprint,
            documentId,
            { fileName: file.name, writingType, wordCount }
          );
          updatedChamberProfile.userId = userId;
          newChamberConfidence = updatedChamberProfile.confidenceLevel;
          newChamberDocs = updatedChamberProfile.documentCount;

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
            }, {
              onConflict: 'user_id,chamber',
            });

          await supabase
            .from("voice_chambers")
            .update({ last_momentum_at: new Date().toISOString() })
            .eq("user_id", userId)
            .eq("chamber", chamber);

          // Optional: store overall in chamber table as well
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
            }, {
              onConflict: 'user_id,chamber',
            });
        } catch (err: any) {
          // If table doesn't exist yet, skip chamber writes
          if (!String(err?.message || '').includes('does not exist')) {
            console.warn('Chamber profile update skipped:', err?.message || err);
          }
        }

        // Mark document as learned
        await supabase
          .from('mirror_documents')
          .update({ 
            learned_at: new Date().toISOString(),
            status: 'learned',
          })
          .eq('id', documentId);

        // Build learning result
        const isFirstDocument = !existingProfile;
        const confidenceGain = isFirstDocument 
          ? updatedProfile.confidenceLevel 
          : updatedProfile.confidenceLevel - existingProfile!.confidenceLevel;
        const observations = buildVoiceObservations(updatedProfile.aggregateFingerprint);
        const previousState = getChamberStatus(
          previousChamberDocs,
          previousChamberConfidence
        );
        const newState = getChamberStatus(newChamberDocs, newChamberConfidence);
        const overallStatus = getChamberStatus(
          updatedProfile.documentCount,
          updatedProfile.confidenceLevel
        );

        learningResult = {
          learned: true,
          isFirstDocument,
          confidenceLevel: updatedProfile.confidenceLevel,
          confidenceLabel: getConfidenceLabel(updatedProfile.confidenceLevel),
          confidenceGain,
          documentCount: updatedProfile.documentCount,
          totalWordCount: updatedProfile.totalWordCount,
          voiceDescription: describeVoice(updatedProfile.aggregateFingerprint),
          observations,
          previousState: previousState.state,
          newState: newState.state,
          stateChanged: previousState.state !== newState.state,
          chamberStatus: newState,
          overallStatus,
          previousOverallState: getChamberStatus(
            previousOverallDocs,
            previousOverallConfidence
          ).state,
        };

      } catch (learnError: any) {
        console.error('Voice learning error:', learnError);
        learningResult = {
          learned: false,
          error: 'Learning failed, but document was uploaded',
          details: learnError?.message,
        };
      }
    } else if (!ingestionDecision.eligible) {
      learningResult = {
        learned: false,
        reason: ingestionDecision.reason,
      };
    } else {
      learningResult = {
        learned: false,
        reason: 'Learning skipped by request',
      };
    }

    // ---- RESPONSE ----
    return NextResponse.json({
      success: true,
      message: learningResult?.learned 
        ? 'Document uploaded and voice profile updated!'
        : 'Document uploaded successfully.',
      
      document: {
        id: documentId,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        wordCount,
        writingType,
        storagePath,
      },

      learning: learningResult,
      observations: learningResult?.observations || [],
      previousState: learningResult?.previousState || null,
      newState: learningResult?.newState || null,
      stateChanged: learningResult?.stateChanged || false,
      chamberStatus: learningResult?.chamberStatus || null,
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
