import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ingestExtensionFingerprint } from "@/lib/mirror-core/extension/ingestion";
import {
  isChamber,
  normalizeDomain,
} from "@/lib/mirror-core/classification";
import type { ExtensionFingerprint } from "@/lib/mirror-core/extension/ingestion";
import { SOURCE_AUTHORITY } from "@/lib/mirror-core/sourceAuthority";
import {
  createSubcategory,
  getSubcategory,
  type MirrorChamber,
} from "@/lib/mirror-mode/subcategoryService";
import {
  saveContextMemory,
  type ContextObservations,
} from "@/lib/mirror-core/contextMemoryService";

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type UnclassifiedQueueRow = {
  id: string;
  source_domain: string;
  capture_source: string;
  fingerprint_data: unknown;
  word_count: number;
  captured_at: string;
  reviewed: boolean;
  assigned_chamber: string | null;
  assigned_at: string | null;
  context_observations: Json;
  ursie_recommendation: Json | null;
  subcategory_id: string | null;
  subcategory_confirmed: boolean;
};

type QueueClassifyBody = {
  chamber: string;
  create_domain_rule?: boolean;
  subcategory_id?: string;
  subcategory_name?: string;
};

type UnclassifiedDeps = {
  resolveUserId: (request: NextRequest) => Promise<string | null>;
  createSupabaseAdmin: () => SupabaseClient;
  ingestExtensionFingerprint?: typeof ingestExtensionFingerprint;
  createSubcategory?: typeof createSubcategory;
  getSubcategory?: typeof getSubcategory;
  saveContextMemory?: typeof saveContextMemory;
};

type MirrorDocumentRow = {
  id: string;
};

function toExtensionFingerprint(value: unknown): ExtensionFingerprint | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.sessionId !== "string" ||
    typeof record.sourceType !== "string" ||
    typeof record.wordCount !== "number"
  ) {
    return null;
  }
  if (!isChamber(typeof record.chamber === "string" ? record.chamber : "general")) {
    return null;
  }

  return record as unknown as ExtensionFingerprint;
}

function chamberToWritingType(chamber: MirrorChamber): string {
  if (chamber === "career") return "professional";
  return chamber;
}

function normalizeContextObservations(value: Json | null): ContextObservations | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const people = Array.isArray(record.people)
    ? record.people
        .map((person) => {
          if (!person || typeof person !== "object") {
            return null;
          }
          const entry = person as Record<string, unknown>;
          const name = typeof entry.name === "string" ? entry.name.trim() : "";
          if (!name) {
            return null;
          }
          return {
            name,
            role: typeof entry.role === "string" ? entry.role : undefined,
            company: typeof entry.company === "string" ? entry.company : undefined,
            pronouns: typeof entry.pronouns === "string" ? entry.pronouns : undefined,
          };
        })
        .filter(Boolean)
    : [];

  return {
    people: people as ContextObservations["people"],
    writing_type: typeof record.writing_type === "string" ? record.writing_type : "",
    relationship_direction:
      record.relationship_direction === "upward" ||
      record.relationship_direction === "peer" ||
      record.relationship_direction === "downward" ||
      record.relationship_direction === "personal"
        ? record.relationship_direction
        : "unknown",
    tone_observed: typeof record.tone_observed === "string" ? record.tone_observed : "",
    recommended_chamber: isChamber(record.recommended_chamber as string)
      ? (record.recommended_chamber as MirrorChamber)
      : "general",
    recommended_subcategory:
      typeof record.recommended_subcategory === "string" ? record.recommended_subcategory : "",
    recommendation_confidence:
      record.recommendation_confidence === "high" ||
      record.recommendation_confidence === "medium" ||
      record.recommendation_confidence === "low"
        ? record.recommendation_confidence
        : "low",
    recommendation_reasoning:
      typeof record.recommendation_reasoning === "string" ? record.recommendation_reasoning : "",
  };
}

async function linkMirrorDocumentToSubcategory(params: {
  supabase: SupabaseClient;
  userId: string;
  queueItem: UnclassifiedQueueRow;
  chamber: MirrorChamber;
  subcategoryId: string;
  fingerprint: ExtensionFingerprint;
}): Promise<string | null> {
  const { supabase, userId, queueItem, chamber, subcategoryId, fingerprint } = params;
  const record =
    queueItem.fingerprint_data && typeof queueItem.fingerprint_data === "object"
      ? (queueItem.fingerprint_data as Record<string, unknown>)
      : null;

  const existingDocumentId =
    record && typeof record.mirror_document_id === "string" ? record.mirror_document_id : null;

  if (existingDocumentId) {
    const { error: updateError } = await supabase
      .from("mirror_documents")
      .update({
        subcategory_id: subcategoryId,
      })
      .eq("id", existingDocumentId)
      .eq("user_id", userId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return existingDocumentId;
  }

  const documentId = `queue-${queueItem.id}-${randomUUID()}`;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("mirror_documents")
    .insert({
      id: documentId,
      user_id: userId,
      file_name: `Queue capture (${queueItem.source_domain})`,
      mime_type: "application/json",
      file_size: JSON.stringify(queueItem.fingerprint_data || {}).length,
      storage_path: `mirror_queue:${queueItem.id}`,
      writing_type: chamberToWritingType(chamber),
      word_count: queueItem.word_count,
      status: "learned",
      training_allowed: true,
      learned_at: now,
      source_authority: SOURCE_AUTHORITY.EXTENSION_CAPTURED,
      excluded_from_profile: false,
      visibility_status: "active",
      epoch_number: 1,
      subcategory_id: subcategoryId,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const { error: queueUpdateError } = await supabase
    .from("mirror_unclassified_queue")
    .update({
      fingerprint_data: {
        ...(record || {}),
        mirror_document_id: data?.id || documentId,
        chamber,
        sessionId: fingerprint.sessionId,
      },
    })
    .eq("id", queueItem.id)
    .eq("user_id", userId);

  if (queueUpdateError) {
    throw new Error(queueUpdateError.message);
  }

  return (data as MirrorDocumentRow | null)?.id || documentId;
}

export async function handleGetUnclassified(
  request: NextRequest,
  deps: UnclassifiedDeps
) {
  const userId = await deps.resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = deps.createSupabaseAdmin();
  const { data, error } = await supabase
    .from("mirror_unclassified_queue")
    .select(
      "id, source_domain, capture_source, fingerprint_data, word_count, captured_at, reviewed, assigned_chamber, assigned_at, context_observations, ursie_recommendation, subcategory_id, subcategory_confirmed"
    )
    .eq("user_id", userId)
    .eq("reviewed", false)
    .order("captured_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    items: (data || []) as UnclassifiedQueueRow[],
  });
}

export async function handleClassifyUnclassified(
  request: NextRequest,
  params: { id: string },
  deps: UnclassifiedDeps
) {
  const userId = await deps.resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as QueueClassifyBody | null;
  if (!body || !isChamber(body.chamber)) {
    return NextResponse.json(
      { error: "Invalid queue classification payload" },
      { status: 400 }
    );
  }

  const supabase = deps.createSupabaseAdmin();
  const ingestFingerprint = deps.ingestExtensionFingerprint || ingestExtensionFingerprint;
  const createSubcategoryRecord = deps.createSubcategory || createSubcategory;
  const getSubcategoryRecord = deps.getSubcategory || getSubcategory;
  const saveContextMemoryEntries = deps.saveContextMemory || saveContextMemory;
  const { data: item, error: itemError } = await supabase
    .from("mirror_unclassified_queue")
    .select(
      "id, source_domain, capture_source, fingerprint_data, word_count, captured_at, reviewed, assigned_chamber, assigned_at, context_observations, ursie_recommendation, subcategory_id, subcategory_confirmed"
    )
    .eq("id", params.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (itemError) {
    return NextResponse.json({ error: itemError.message }, { status: 500 });
  }

  if (!item?.id) {
    return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
  }

  const fingerprint = toExtensionFingerprint(item.fingerprint_data);
  if (!fingerprint) {
    return NextResponse.json(
      { error: "Queue item fingerprint is invalid" },
      { status: 400 }
    );
  }

  const ingested = await ingestFingerprint({
    supabase,
    userId,
    fingerprint: {
      ...fingerprint,
      chamber: body.chamber,
    },
    hostname: item.source_domain,
  });

  let resolvedSubcategoryId: string | null = null;

  if (body.subcategory_id) {
    const subcategory = await getSubcategoryRecord(userId, body.subcategory_id, supabase);
    if (!subcategory) {
      return NextResponse.json({ error: "Subcategory not found" }, { status: 404 });
    }
    if (subcategory.parent_chamber !== body.chamber) {
      return NextResponse.json(
        { error: "Subcategory does not belong to the assigned chamber" },
        { status: 400 }
      );
    }
    resolvedSubcategoryId = subcategory.id;
  } else if (body.subcategory_name?.trim()) {
    const created = await createSubcategoryRecord(
      userId,
      body.subcategory_name,
      body.chamber,
      supabase
    );
    resolvedSubcategoryId = created.id;
  }

  if (resolvedSubcategoryId) {
    await linkMirrorDocumentToSubcategory({
      supabase,
      userId,
      queueItem: item as UnclassifiedQueueRow,
      chamber: body.chamber,
      subcategoryId: resolvedSubcategoryId,
      fingerprint: {
        ...fingerprint,
        chamber: body.chamber,
      },
    });

    const observations = normalizeContextObservations((item as UnclassifiedQueueRow).context_observations);
    if (observations) {
      await saveContextMemoryEntries(userId, resolvedSubcategoryId, observations, supabase);
    }
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("mirror_unclassified_queue")
    .update({
      reviewed: true,
      assigned_chamber: body.chamber,
      assigned_at: now,
      subcategory_id: resolvedSubcategoryId,
      subcategory_confirmed: Boolean(resolvedSubcategoryId),
    })
    .eq("id", item.id)
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (body.create_domain_rule) {
    const domain = normalizeDomain(item.source_domain);
    if (domain) {
      const { error: ruleError } = await supabase
        .from("mirror_domain_rules")
        .upsert(
          {
            user_id: userId,
            domain,
            target_chamber: body.chamber,
            updated_at: now,
          },
          { onConflict: "user_id,domain" }
        );

      if (ruleError) {
        return NextResponse.json({ error: ruleError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({
    success: true,
    itemId: item.id,
    assignedChamber: body.chamber,
    subcategoryId: resolvedSubcategoryId,
    captured: ingested.captured,
  });
}
