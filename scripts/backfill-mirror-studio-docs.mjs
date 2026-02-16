#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex < 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

const dryRun = !process.argv.includes("--apply");
const userIdFilter = argValue("--user-id");
const limitArg = argValue("--limit");
const rowLimit = limitArg ? Number(limitArg) : null;
const includeReferenceDocs = process.argv.includes("--include-reference");

const workspaceRoot = process.cwd();
loadEnvFile(path.join(workspaceRoot, ".env.local"));
loadEnvFile(path.join(workspaceRoot, ".env"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set env vars before running."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const EXCLUDE_PATTERN = /syllabus|assignment[_\s-]?requirements?|writing[_\s-]?requirements?|course[_\s-]?requirements?|school[_\s-]?requirements?|job[_\s-]?analysis|job[_\s-]?posting|requirements?/i;

function wordCount(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function shouldExcludeCareer(doc) {
  if (includeReferenceDocs) return false;
  const haystack = [
    doc.file_name,
    doc.file_type,
    doc.upload_source,
    doc.source,
  ]
    .filter(Boolean)
    .join(" ");
  return EXCLUDE_PATTERN.test(haystack);
}

function shouldExcludeAcademic(doc) {
  if (includeReferenceDocs) return false;
  const haystack = [doc.title, doc.topic].filter(Boolean).join(" ");
  return EXCLUDE_PATTERN.test(haystack);
}

async function hasConsent(userId, studio) {
  const { data } = await supabase
    .from("mirror_mode_consent")
    .select("id")
    .eq("user_id", userId)
    .eq("studio", studio)
    .maybeSingle();
  return Boolean(data?.id);
}

async function findMirrorDocument(userId, storagePath) {
  const { data } = await supabase
    .from("mirror_documents")
    .select("id")
    .eq("user_id", userId)
    .eq("storage_path", storagePath)
    .maybeSingle();
  return data?.id || null;
}

async function ensureMirrorContent(documentId, text) {
  const { data: existing } = await supabase
    .from("mirror_document_content")
    .select("document_id")
    .eq("document_id", documentId)
    .maybeSingle();

  if (existing?.document_id) {
    if (!dryRun) {
      await supabase
        .from("mirror_document_content")
        .update({
          extracted_text: text,
          extraction_method: "studio_backfill",
        })
        .eq("document_id", documentId);
    }
    return;
  }

  if (!dryRun) {
    await supabase
      .from("mirror_document_content")
      .insert({
        document_id: documentId,
        extracted_text: text,
        extraction_method: "studio_backfill",
      });
  }
}

async function getCurrentEpoch(userId) {
  const { data } = await supabase
    .from("voice_profile_epochs")
    .select("epoch_number")
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("epoch_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.epoch_number || 1;
}

async function upsertMirrorDoc({
  userId,
  storagePath,
  fileName,
  mimeType,
  fileSize,
  writingType,
  text,
  createdAt,
}) {
  const existingId = await findMirrorDocument(userId, storagePath);
  const wc = wordCount(text);
  if (wc < 50) return { created: false, updated: false, skipped: true, reason: "too_short" };

  if (existingId) {
    if (!dryRun) {
      await supabase
        .from("mirror_documents")
        .update({
          file_name: fileName,
          mime_type: mimeType || "text/plain",
          file_size: fileSize || text.length,
          writing_type: writingType,
          word_count: wc,
          status: "learned",
          learned_at: createdAt || new Date().toISOString(),
        })
        .eq("id", existingId);
    }
    await ensureMirrorContent(existingId, text);
    return { created: false, updated: true, skipped: false, reason: null };
  }

  const epochNumber = await getCurrentEpoch(userId);
  if (!dryRun) {
    let insertPayload = {
      user_id: userId,
      file_name: fileName,
      mime_type: mimeType || "text/plain",
      file_size: fileSize || text.length,
      storage_path: storagePath,
      writing_type: writingType,
      word_count: wc,
      status: "learned",
      training_allowed: true,
      learned_at: createdAt || new Date().toISOString(),
      visibility_status: "active",
      epoch_number: epochNumber,
    };

    let { data: inserted, error } = await supabase
      .from("mirror_documents")
      .insert(insertPayload)
      .select("id")
      .single();

    if (
      error?.message?.includes("column") ||
      error?.message?.includes("visibility_status") ||
      error?.message?.includes("epoch_number")
    ) {
      insertPayload = {
        user_id: userId,
        file_name: fileName,
        mime_type: mimeType || "text/plain",
        file_size: fileSize || text.length,
        storage_path: storagePath,
        writing_type: writingType,
        word_count: wc,
        status: "learned",
        training_allowed: true,
        learned_at: createdAt || new Date().toISOString(),
      };
      ({ data: inserted, error } = await supabase
        .from("mirror_documents")
        .insert(insertPayload)
        .select("id")
        .single());
    }

    if (error || !inserted?.id) {
      return { created: false, updated: false, skipped: true, reason: "insert_failed" };
    }

    await ensureMirrorContent(inserted.id, text);
  }

  return { created: true, updated: false, skipped: false, reason: null };
}

async function fetchAllRows(baseQueryFactory) {
  const pageSize = 500;
  const rows = [];
  let from = 0;

  while (true) {
    let query = baseQueryFactory().range(from, from + pageSize - 1);
    const { data, error } = await query;
    if (error) throw error;
    const batch = data || [];
    if (batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
    if (rowLimit && rows.length >= rowLimit) break;
  }

  return rowLimit ? rows.slice(0, rowLimit) : rows;
}

async function run() {
  const startedAt = Date.now();
  const stats = {
    scannedCareer: 0,
    scannedAcademic: 0,
    created: 0,
    updated: 0,
    skippedExcluded: 0,
    skippedConsent: 0,
    skippedShort: 0,
    skippedInsertFailed: 0,
  };

  const consentCache = new Map();
  const hasConsentCached = async (userId, studio) => {
    const key = `${userId}:${studio}`;
    if (!consentCache.has(key)) {
      consentCache.set(key, await hasConsent(userId, studio));
    }
    return consentCache.get(key);
  };

  const careerRows = await fetchAllRows(() => {
    let query = supabase
      .from("user_documents")
      .select(
        "id,user_id,file_name,file_type,upload_source,source,extracted_text,created_at,is_active"
      )
      .eq("is_active", true)
      .not("extracted_text", "is", null);
    if (userIdFilter) query = query.eq("user_id", userIdFilter);
    return query.order("created_at", { ascending: true });
  });

  for (const row of careerRows) {
    stats.scannedCareer += 1;
    if (shouldExcludeCareer(row)) {
      stats.skippedExcluded += 1;
      continue;
    }

    const consent = await hasConsentCached(row.user_id, "career");
    if (!consent) {
      stats.skippedConsent += 1;
      continue;
    }

    const result = await upsertMirrorDoc({
      userId: row.user_id,
      storagePath: `studio:career:${row.id}`,
      fileName: row.file_name || "Career document",
      mimeType: row.file_type || "text/plain",
      fileSize: row.extracted_text?.length || null,
      writingType: "professional",
      text: row.extracted_text || "",
      createdAt: row.created_at || new Date().toISOString(),
    });

    if (result.created) stats.created += 1;
    if (result.updated) stats.updated += 1;
    if (result.reason === "too_short") stats.skippedShort += 1;
    if (result.reason === "insert_failed") stats.skippedInsertFailed += 1;
  }

  const academicRows = await fetchAllRows(() => {
    let query = supabase
      .from("study_materials")
      .select("id,user_id,title,topic,content,source_type,created_at")
      .eq("source_type", "uploaded")
      .not("content", "is", null);
    if (userIdFilter) query = query.eq("user_id", userIdFilter);
    return query.order("created_at", { ascending: true });
  });

  for (const row of academicRows) {
    stats.scannedAcademic += 1;
    if (shouldExcludeAcademic(row)) {
      stats.skippedExcluded += 1;
      continue;
    }

    const consent = await hasConsentCached(row.user_id, "academic");
    if (!consent) {
      stats.skippedConsent += 1;
      continue;
    }

    const result = await upsertMirrorDoc({
      userId: row.user_id,
      storagePath: `studio:academic:${row.id}`,
      fileName: row.title || "Academic upload",
      mimeType: "text/plain",
      fileSize: row.content?.length || null,
      writingType: "academic",
      text: row.content || "",
      createdAt: row.created_at || new Date().toISOString(),
    });

    if (result.created) stats.created += 1;
    if (result.updated) stats.updated += 1;
    if (result.reason === "too_short") stats.skippedShort += 1;
    if (result.reason === "insert_failed") stats.skippedInsertFailed += 1;
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(
    JSON.stringify(
      {
        dryRun,
        includeReferenceDocs,
        userIdFilter: userIdFilter || null,
        scannedCareer: stats.scannedCareer,
        scannedAcademic: stats.scannedAcademic,
        created: stats.created,
        updated: stats.updated,
        skippedExcluded: stats.skippedExcluded,
        skippedConsent: stats.skippedConsent,
        skippedShort: stats.skippedShort,
        skippedInsertFailed: stats.skippedInsertFailed,
        elapsedMs,
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error("Backfill failed:", error?.message || error);
  process.exit(1);
});
