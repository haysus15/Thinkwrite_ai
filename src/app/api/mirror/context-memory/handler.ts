import { NextRequest, NextResponse } from "next/server.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deleteContextMemoryEntry,
  updateContextMemoryEntry,
} from "@/lib/mirror-core/contextMemoryService";
import {
  type ContextMemoryEntry,
  getSubcategory,
  type Subcategory,
} from "@/lib/mirror-mode/subcategoryService";

type ContextMemoryBody = {
  subcategory_id?: string;
  entity_type?: "person" | "company" | "place" | "role" | "other";
  entity_name?: string;
  attributes?: Record<string, string>;
};

type ContextMemoryUpdateBody = {
  attributes?: Record<string, string>;
};

type GroupedContextMemory = {
  subcategory: Subcategory;
  chamber: string;
  entries: ContextMemoryEntry[];
};

export type ContextMemoryDeps = {
  resolveUserId: (request: NextRequest) => Promise<string | null>;
  createSupabaseAdmin: () => SupabaseClient;
  getSubcategory?: typeof getSubcategory;
  updateContextMemoryEntry?: typeof updateContextMemoryEntry;
  deleteContextMemoryEntry?: typeof deleteContextMemoryEntry;
};

const ENTITY_TYPES = new Set(["person", "company", "place", "role", "other"]);

function normalizeAttributes(value: Record<string, string> | undefined): Record<string, string> {
  return Object.entries(value || {}).reduce<Record<string, string>>((acc, [key, entry]) => {
    const nextKey = key.trim();
    const nextValue = String(entry || "").trim();
    if (nextKey && nextValue) {
      acc[nextKey] = nextValue;
    }
    return acc;
  }, {});
}

async function readJsonBody<T>(request: NextRequest): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export async function handleGetContextMemory(
  request: NextRequest,
  deps: ContextMemoryDeps
) {
  const userId = await deps.resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = deps.createSupabaseAdmin();
  const [{ data: subcategories, error: subcategoryError }, { data: entries, error: entryError }] =
    await Promise.all([
      supabase
        .from("mirror_subcategories")
        .select("*")
        .eq("user_id", userId)
        .order("parent_chamber", { ascending: true })
        .order("document_count", { ascending: false }),
      supabase
        .from("mirror_context_memory")
        .select("*")
        .eq("user_id", userId)
        .order("entity_name", { ascending: true }),
    ]);

  if (subcategoryError) {
    return NextResponse.json({ error: subcategoryError.message }, { status: 500 });
  }
  if (entryError) {
    return NextResponse.json({ error: entryError.message }, { status: 500 });
  }

  const entriesBySubcategory = new Map<string, ContextMemoryEntry[]>();
  for (const entry of (entries || []) as ContextMemoryEntry[]) {
    const current = entriesBySubcategory.get(entry.subcategory_id) || [];
    current.push(entry);
    entriesBySubcategory.set(entry.subcategory_id, current);
  }

  const grouped = ((subcategories || []) as Subcategory[]).map((subcategory) => ({
    subcategory,
    chamber: subcategory.parent_chamber,
    entries: entriesBySubcategory.get(subcategory.id) || [],
  }));

  return NextResponse.json({
    subcategories: grouped satisfies GroupedContextMemory[],
  });
}

export async function handlePostContextMemory(
  request: NextRequest,
  deps: ContextMemoryDeps
) {
  const userId = await deps.resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody<ContextMemoryBody>(request);
  const entityName = body?.entity_name?.trim() || "";
  if (
    !body?.subcategory_id ||
    !ENTITY_TYPES.has(body.entity_type || "") ||
    !entityName
  ) {
    return NextResponse.json({ error: "Invalid context memory payload" }, { status: 400 });
  }

  const supabase = deps.createSupabaseAdmin();
  const loadSubcategory = deps.getSubcategory || getSubcategory;
  const subcategory = await loadSubcategory(userId, body.subcategory_id, supabase);
  if (!subcategory) {
    return NextResponse.json({ error: "Subcategory not found" }, { status: 404 });
  }

  const attributes = normalizeAttributes(body.attributes);
  const { data: existing, error: existingError } = await supabase
    .from("mirror_context_memory")
    .select("*")
    .eq("user_id", userId)
    .eq("subcategory_id", body.subcategory_id)
    .eq("entity_name", entityName)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existing) {
    const mergedAttributes = {
      ...((existing.attributes as Record<string, string>) || {}),
      ...attributes,
    };
    const { data, error } = await supabase
      .from("mirror_context_memory")
      .update({
        entity_type: body.entity_type,
        attributes: mergedAttributes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, entry: data as ContextMemoryEntry });
  }

  const { data, error } = await supabase
    .from("mirror_context_memory")
    .insert({
      user_id: userId,
      subcategory_id: body.subcategory_id,
      entity_type: body.entity_type,
      entity_name: entityName,
      attributes,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, entry: data as ContextMemoryEntry });
}

export async function handlePatchContextMemory(
  request: NextRequest,
  params: { id: string },
  deps: ContextMemoryDeps
) {
  const userId = await deps.resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody<ContextMemoryUpdateBody>(request);
  if (!body?.attributes || typeof body.attributes !== "object") {
    return NextResponse.json({ error: "Invalid context memory payload" }, { status: 400 });
  }

  const supabase = deps.createSupabaseAdmin();
  const { data: entry, error: lookupError } = await supabase
    .from("mirror_context_memory")
    .select("id, user_id")
    .eq("id", params.id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }
  if (!entry || entry.user_id !== userId) {
    return NextResponse.json({ error: "Context memory entry not found" }, { status: 404 });
  }

  const updateEntry = deps.updateContextMemoryEntry || updateContextMemoryEntry;
  try {
    await updateEntry(params.id, normalizeAttributes(body.attributes), supabase);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update context memory" },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("mirror_context_memory")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, entry: data as ContextMemoryEntry });
}

export async function handleDeleteContextMemory(
  request: NextRequest,
  params: { id: string },
  deps: ContextMemoryDeps
) {
  const userId = await deps.resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const removeEntry = deps.deleteContextMemoryEntry || deleteContextMemoryEntry;
  const supabase = deps.createSupabaseAdmin();
  try {
    await removeEntry(params.id, userId, supabase);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete context memory" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
