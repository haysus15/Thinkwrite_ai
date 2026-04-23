import { NextRequest, NextResponse } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/api/rateLimiter";
import {
  ingestExtensionFingerprint,
  type ExtensionFingerprint,
} from "@/lib/mirror-core/extension/ingestion";
import { isChamber } from "@/lib/mirror-core/classification";
import {
  extractContextObservations,
  generateUrsieRecommendationMessage,
} from "@/lib/mirror-core/contextMemoryService";

export const EXTENSION_FALLBACK_CHAMBER = "general";

export function isValidFingerprint(body: any): body is ExtensionFingerprint {
  return (
    body &&
    typeof body === "object" &&
    typeof body.sessionId === "string" &&
    isChamber(String(body.chamber)) &&
    body.sourceType === "extension" &&
    typeof body.wordCount === "number"
  );
}

export type ExtensionFingerprintRouteDeps = {
  resolveUserId: (request: NextRequest) => Promise<string | null>;
  createSupabaseAdmin: () => SupabaseClient;
  ingestExtensionFingerprint: typeof ingestExtensionFingerprint;
  extractContextObservations?: typeof extractContextObservations;
  generateUrsieRecommendationMessage?: typeof generateUrsieRecommendationMessage;
  scheduleBackgroundTask?: (task: Promise<void>) => void;
};

function buildFingerprintObservationText(
  hostname: string,
  chamber: ExtensionFingerprint["chamber"],
  fingerprint: ExtensionFingerprint
) {
  return [
    `Captured from ${hostname}.`,
    `Chamber routing: ${chamber}.`,
    `Word count: ${fingerprint.wordCount}.`,
    `Average sentence length: ${fingerprint.avgSentenceLength}.`,
    `Lexical density: ${fingerprint.lexicalDensity}.`,
    `Passive voice rate: ${fingerprint.passiveVoiceRate}.`,
    `Question rate: ${fingerprint.questionRate}.`,
    `Opening pattern subject-first: ${fingerprint.openingPatterns.subjectFirst}.`,
  ].join(" ");
}

function scheduleBackgroundTask(task: Promise<void>) {
  void task.catch((error) => {
    console.error("[Mirror Extension Fingerprint] queue enrichment failed:", error);
  });
}

async function hasGeneralConsent(
  supabase: SupabaseClient,
  userId: string,
  chamber: ExtensionFingerprint["chamber"]
): Promise<boolean> {
  const { data: consent } = await supabase
    .from("mirror_mode_consent")
    .select("id")
    .eq("user_id", userId)
    .eq("studio", chamber)
    .maybeSingle();

  return Boolean(consent?.id);
}

async function resolveDomainRule(
  supabase: SupabaseClient,
  userId: string,
  hostname: string
): Promise<ExtensionFingerprint["chamber"] | null> {
  const { data } = await supabase
    .from("mirror_domain_rules")
    .select("id, target_chamber")
    .eq("user_id", userId)
    .eq("domain", hostname)
    .maybeSingle();

  return data?.target_chamber && isChamber(data.target_chamber)
    ? data.target_chamber
    : null;
}

export async function handleExtensionFingerprintPost(
  request: NextRequest,
  deps: ExtensionFingerprintRouteDeps
) {
  const userId = await deps.resolveUserId(request);
  if (!userId) {
    console.warn("[Mirror Extension Fingerprint] Unauthorized request");
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidFingerprint(body)) {
    return NextResponse.json({ success: false, error: "Invalid fingerprint payload" }, { status: 400 });
  }

  const rate = checkRateLimit(userId, "mirror-extension-fingerprint", {
    maxRequests: 50,
    windowMs: 60 * 60 * 1000,
  });
  if (rate.limited) {
    return NextResponse.json(
      { success: true, captured: false, chamber: EXTENSION_FALLBACK_CHAMBER },
      { status: 200 }
    );
  }

  const hostname =
    (request.headers.get("x-extension-hostname") || "").trim() ||
    request.headers.get("x-forwarded-host") ||
    "unknown";

  try {
    const supabase = deps.createSupabaseAdmin();
    const extractObservations = deps.extractContextObservations || extractContextObservations;
    const buildRecommendation =
      deps.generateUrsieRecommendationMessage || generateUrsieRecommendationMessage;
    const runInBackground = deps.scheduleBackgroundTask || scheduleBackgroundTask;
    const routedChamber =
      (await resolveDomainRule(supabase, userId, hostname)) ||
      EXTENSION_FALLBACK_CHAMBER;
    const hasConsent = await hasGeneralConsent(supabase, userId, routedChamber);
    if (!hasConsent) {
      return NextResponse.json(
        { success: false, error: "consent_required" },
        { status: 403 }
      );
    }

    if (routedChamber === EXTENSION_FALLBACK_CHAMBER) {
      const capturedAt = body.capturedAt || new Date().toISOString();
      const { error: queueError } = await supabase
        .from("mirror_unclassified_queue")
        .insert({
          user_id: userId,
          source_domain: hostname,
          capture_source: "extension",
          fingerprint_data: {
            ...body,
            chamber: EXTENSION_FALLBACK_CHAMBER,
          },
          word_count: body.wordCount,
          captured_at: capturedAt,
        });

      if (queueError) {
        throw new Error(queueError.message);
      }

      runInBackground(
        (async () => {
          const observations = await extractObservations(
            buildFingerprintObservationText(hostname, routedChamber, body)
          );
          await buildRecommendation(observations, userId);

          const { data: queueItem, error: queueLookupError } = await supabase
            .from("mirror_unclassified_queue")
            .select("id")
            .eq("user_id", userId)
            .eq("source_domain", hostname)
            .eq("capture_source", "extension")
            .eq("captured_at", capturedAt)
            .maybeSingle();

          if (queueLookupError) {
            throw new Error(queueLookupError.message);
          }
          if (!queueItem?.id) {
            return;
          }

          const { error: updateError } = await supabase
            .from("mirror_unclassified_queue")
            .update({
              context_observations: observations,
              ursie_recommendation: {
                chamber: observations.recommended_chamber,
                subcategory_name: observations.recommended_subcategory,
                confidence: observations.recommendation_confidence,
                reasoning: observations.recommendation_reasoning,
              },
            })
            .eq("id", queueItem.id)
            .eq("user_id", userId);

          if (updateError) {
            throw new Error(updateError.message);
          }
        })().catch((error) => {
          console.error("[Mirror Extension Fingerprint] queue enrichment failed:", error);
        })
      );

      return NextResponse.json(
        {
          success: true,
          captured: true,
          chamber: EXTENSION_FALLBACK_CHAMBER,
          queued: true,
        },
        { status: 200 }
      );
    }

    const result = await deps.ingestExtensionFingerprint({
      supabase,
      userId,
      fingerprint: {
        ...body,
        chamber: routedChamber,
      },
      hostname,
    });

    return NextResponse.json(
      {
        success: true,
        captured: result.captured,
        chamber: result.chamber,
        queued: false,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Mirror Extension Fingerprint]", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process fingerprint",
      },
      { status: 500 }
    );
  }
}
